import { detectProduct } from "../products.ts";
import { toIsoDate } from "../text.ts";
import type { Entry, Get, Source } from "../types.ts";

const UPDATES_URL = "https://api.msrc.microsoft.com/cvrf/v3.0/updates";
const GUIDE_URL = "https://msrc.microsoft.com/update-guide/vulnerability/";
const RELEASE_URL = "https://msrc.microsoft.com/update-guide/releaseNote/";
/** 月初でも前月の悪用情報を落とさないよう、直近2か月分を読む */
const MONTHS = 2;
/** 指定しないと XML が返る */
const JSON_OPTIONS = { accept: "application/json" };

interface Update {
  ID: string;
  InitialReleaseDate: string;
  CvrfUrl: string;
}

interface Threat {
  Type: number;
  Description?: { Value?: string };
}

interface Vulnerability {
  CVE?: string;
  Title?: { Value?: string };
  Notes?: Array<{ Type?: number; Value?: string }>;
  Threats?: Threat[];
  RevisionHistory?: Array<{ Date?: string }>;
}

interface CvrfDocument {
  DocumentTitle?: { Value?: string };
  Vulnerability?: Vulnerability[];
}

const THREAT_EXPLOIT_STATUS = 1;
const THREAT_SEVERITY = 3;
const NOTE_TAG = 7;

/** Linux 向けと Chromium 由来の項目は Microsoft 製品の更新として数えない */
function isMicrosoftProduct(vulnerability: Vulnerability): boolean {
  const tags = (vulnerability.Notes ?? [])
    .filter((note) => note.Type === NOTE_TAG)
    .map((note) => note.Value ?? "");
  return !tags.some((tag) => /mariner|azure linux|microsoft edge/i.test(tag));
}

function threatValues(vulnerability: Vulnerability, type: number): string[] {
  return (vulnerability.Threats ?? [])
    .filter((threat) => threat.Type === type)
    .map((threat) => threat.Description?.Value ?? "");
}

function toEntries(update: Update, document: CvrfDocument): Entry[] {
  const vulnerabilities = (document.Vulnerability ?? []).filter(
    isMicrosoftProduct,
  );
  const publishedAt = toIsoDate(update.InitialReleaseDate);
  if (!publishedAt) return [];

  const critical = vulnerabilities.some((vulnerability) =>
    threatValues(vulnerability, THREAT_SEVERITY).includes("Critical"),
  );
  const monthly: Entry = {
    source: "msrc",
    key: update.ID,
    title: `Windows / Office の月例セキュリティ更新（${update.ID}）`,
    url: `${RELEASE_URL}${update.ID}`,
    publishedAt,
    body: "",
    treatment: "facts",
    product: "windows-office",
    cveCount: vulnerabilities.length,
    ...(critical ? { vendorSeverity: "critical" as const } : {}),
  };

  const exploited = vulnerabilities.flatMap((vulnerability): Entry[] => {
    const isExploited = threatValues(vulnerability, THREAT_EXPLOIT_STATUS).some(
      (value) => value.includes("Exploited:Yes"),
    );
    if (!isExploited || !vulnerability.CVE) return [];
    const title = vulnerability.Title?.Value ?? vulnerability.CVE;
    return [
      {
        source: "msrc",
        key: vulnerability.CVE,
        title,
        url: `${GUIDE_URL}${vulnerability.CVE}`,
        publishedAt:
          toIsoDate(vulnerability.RevisionHistory?.[0]?.Date ?? "") ??
          publishedAt,
        body: vulnerability.CVE,
        treatment: "facts",
        exploited: true,
        product: detectProduct(`Microsoft ${title}`),
      },
    ];
  });

  return [monthly, ...exploited];
}

export const msrc: Source = {
  id: "msrc",
  name: "Microsoft MSRC",
  async load(get: Get) {
    const { value } = JSON.parse(await get(UPDATES_URL, JSON_OPTIONS)) as {
      value: Update[];
    };
    const latest = [...value]
      .sort(
        (a, b) =>
          Date.parse(b.InitialReleaseDate) - Date.parse(a.InitialReleaseDate),
      )
      .slice(0, MONTHS);
    const entries: Entry[] = [];
    for (const update of latest) {
      const document = JSON.parse(
        await get(update.CvrfUrl, JSON_OPTIONS),
      ) as CvrfDocument;
      entries.push(...toEntries(update, document));
    }
    return entries;
  },
};
