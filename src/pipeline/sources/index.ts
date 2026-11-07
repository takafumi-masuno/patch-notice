import type { FeedEntry } from "../feed.ts";
import { isCaIncident } from "../text.ts";
import type { Entry, Source, VendorSeverity } from "../types.ts";
import { feedSource } from "./feedSource.ts";
import { kev } from "./kev.ts";
import { msrc } from "./msrc.ts";

function ciscoExtras(entry: FeedEntry): Partial<Entry> {
  const rating = entry.body
    .match(/Security Impact Rating:\s*(\w+)/i)?.[1]
    ?.toLowerCase();
  const severity: Record<string, VendorSeverity> = {
    critical: "critical",
    high: "high",
    medium: "medium",
    low: "low",
    informational: "info",
  };
  const vendorSeverity = rating ? severity[rating] : undefined;
  return {
    // URL の問い合わせ文字列は配信の記録用なので、公開データには残さない
    url: entry.url.split("?")[0],
    key: entry.url.split("?")[0],
    ...(vendorSeverity ? { vendorSeverity } : {}),
  };
}

function chromeExtras(entry: FeedEntry): Partial<Entry> {
  const version = entry.body.match(/\b\d{2,3}\.0\.\d{3,5}\.\d{1,3}\b/)?.[0];
  return {
    title: version ? `Chrome ${version}（Stable）` : "Chrome の Stable 更新",
    ...(version ? { version } : {}),
  };
}

function slackExtras(platform: string, entry: FeedEntry): Partial<Entry> {
  const version = entry.title.match(/\d+\.\d+\.\d+/)?.[0];
  return {
    title: `Slack for ${platform} ${version ?? ""}`.trim(),
    ...(version ? { version } : {}),
    ...(/significant security/i.test(entry.body)
      ? { vendorSeverity: "high" as const }
      : {}),
  };
}

const mentionsSecurity = (entry: FeedEntry) =>
  /security/i.test(`${entry.title} ${entry.body}`);

const slack = (platform: string, path: string) =>
  feedSource({
    id: `slack-${path}`,
    name: `Slack (${platform})`,
    urls: [`https://slack.com/release-notes/${path}/rss`],
    treatment: "facts",
    product: "slack",
    filter: (entry) => /security guidance/i.test(entry.body),
    map: (entry) => slackExtras(platform, entry),
  });

export const sources: Source[] = [
  kev,
  feedSource({
    id: "cisco",
    name: "Cisco",
    urls: [
      "https://sec.cloudapps.cisco.com/security/center/psirtrss20/CiscoSecurityAdvisory.xml",
    ],
    treatment: "ai-summary",
    product: "cisco",
    map: ciscoExtras,
  }),
  feedSource({
    id: "mozilla",
    name: "Mozilla Security Blog",
    urls: ["https://blog.mozilla.org/security/feed/"],
    // CC BY-SA のため、要約せずタイトルとリンクで出す。検知は本文で行う
    treatment: "title-link",
    filter: (entry) => isCaIncident(`${entry.title}\n${entry.body}`),
  }),
  feedSource({
    id: "jpcert",
    name: "JPCERT/CC",
    urls: ["https://www.jpcert.or.jp/rss/jpcert.rdf"],
    treatment: "title-link",
    // Weekly Report は過去の注意喚起をまとめた記事なので、単独の項目にしない
    filter: (entry) => !entry.title.startsWith("Weekly Report"),
    map: (entry) => ({ nationalAlert: entry.title.startsWith("注意喚起") }),
  }),
  feedSource({
    id: "ipa",
    name: "IPA",
    urls: ["https://www.ipa.go.jp/security/alert-rss.rdf"],
    treatment: "title-link",
    map: () => ({ nationalAlert: true }),
  }),
  feedSource({
    id: "jvn",
    name: "JVN",
    urls: ["https://jvn.jp/rss/jvn.rdf"],
    treatment: "title-link",
  }),
  feedSource({
    id: "kubernetes",
    name: "Kubernetes",
    urls: [
      "https://kubernetes.io/docs/reference/issues-security/official-cve-feed/feed.xml",
    ],
    treatment: "title-link",
    product: "kubernetes",
  }),
  feedSource({
    id: "chrome",
    name: "Chrome Releases",
    urls: ["https://chromereleases.googleblog.com/feeds/posts/default"],
    treatment: "facts",
    product: "chrome",
    filter: (entry) => entry.title === "Stable Channel Update for Desktop",
    map: chromeExtras,
  }),
  msrc,
  slack("Windows", "windows"),
  slack("Mac", "mac"),
  feedSource({
    id: "nodejs",
    name: "Node.js",
    urls: ["https://nodejs.org/en/feed/vulnerability.xml"],
    treatment: "facts",
    product: "nodejs",
  }),
  feedSource({
    id: "php",
    name: "PHP",
    urls: ["https://www.php.net/feed.atom"],
    treatment: "facts",
    product: "php",
    filter: mentionsSecurity,
    map: (entry) =>
      /critical/i.test(entry.title) ? { vendorSeverity: "critical" } : {},
  }),
  feedSource({
    id: "python",
    name: "Python",
    urls: ["https://blog.python.org/feeds/posts/default"],
    treatment: "facts",
    product: "python",
    filter: mentionsSecurity,
  }),
  feedSource({
    id: "wordpress",
    name: "WordPress",
    urls: ["https://wordpress.org/news/category/security/feed/"],
    treatment: "facts",
    product: "wordpress",
  }),
  feedSource({
    id: "apple",
    name: "Apple Developer",
    urls: ["https://developer.apple.com/news/releases/rss/releases.rss"],
    treatment: "version-link",
    product: "apple",
    filter: (entry) =>
      /^(iOS|iPadOS|macOS) \d/.test(entry.title) &&
      !/beta|\bRC\b/i.test(entry.title),
    map: (entry) => {
      const version = entry.title.match(/\d+(?:\.\d+)+/)?.[0];
      const os = entry.title.split(" ")[0];
      // 同じバージョンのビルド違いは1件にまとめる
      return version ? { version, key: `${os} ${version}` } : {};
    },
  }),
];
