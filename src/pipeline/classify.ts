import { createHash } from "node:crypto";
import { audienceFor, detectProduct } from "./products.ts";
import { RELATED_KEV_REASON } from "./reasons.ts";
import { extractCves, isCaIncident, mentionsExploitation } from "./text.ts";
import type { Entry, Item, ProductId, Urgency } from "./types.ts";

export function itemId(source: string, key: string): string {
  return createHash("sha256")
    .update(`${source}:${key}`)
    .digest("hex")
    .slice(0, 16);
}

/** 過去の項目の CVE が後から KEV に載った場合に、判定を上げる */
export function applyKev(item: Item, kevCves: ReadonlySet<string>): Item {
  if (item.exploited || !item.cves.some((cve) => kevCves.has(cve))) {
    return item;
  }
  return {
    ...item,
    exploited: true,
    urgency: "action",
    urgencyReasons: [RELATED_KEV_REASON, ...item.urgencyReasons],
  };
}

/** 緊急度は AI に決めさせず、ここの規則だけで判定する */
export function classify(entry: Entry, kevCves: ReadonlySet<string>): Item {
  const text = `${entry.title}\n${entry.body}`;
  const cves = extractCves(text);
  const caIncident = isCaIncident(text);
  const inKev = entry.exploited === true && entry.source === "kev";
  const joinedKev = !inKev && cves.some((cve) => kevCves.has(cve));
  const vendorExploited = entry.exploited === true && !inKev;
  const textExploited = mentionsExploitation(entry.body);
  const exploited = inKev || joinedKev || vendorExploited || textExploited;

  const reasons: string[] = [];
  if (inKev) reasons.push("KEV に掲載");
  if (joinedKev) reasons.push(RELATED_KEV_REASON);
  if (vendorExploited || textExploited) reasons.push("メーカーが悪用を明記");
  if (entry.nationalAlert) reasons.push("国内機関の注意喚起");
  const action = reasons.length > 0;

  if (caIncident) reasons.push("認証局の事案らしい語句に一致");
  if (entry.vendorSeverity === "critical" || entry.vendorSeverity === "high") {
    reasons.push(`メーカーの評価が ${entry.vendorSeverity}`);
  }

  let urgency: Urgency = "normal";
  if (action) urgency = "action";
  else if (reasons.length > 0) urgency = "review";

  // Python の更新のように本文で触れているだけの場合は、製品の更新のまま扱う
  const product: ProductId = isCaIncident(entry.title)
    ? "ca-incident"
    : (entry.product ?? detectProduct(entry.title));

  return {
    id: itemId(entry.source, entry.key),
    source: entry.source,
    product,
    title: entry.title,
    url: entry.url,
    publishedAt: entry.publishedAt,
    cves: entry.cveCount === undefined ? cves : [],
    cveCount: entry.cveCount ?? cves.length,
    exploited,
    urgency,
    urgencyReasons: reasons,
    audience: audienceFor(product, entry.title),
    treatment: entry.treatment,
    ...(entry.version ? { version: entry.version } : {}),
    ...(entry.vendorSeverity ? { vendorSeverity: entry.vendorSeverity } : {}),
  };
}
