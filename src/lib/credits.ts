export interface SourceCredit {
  name: string;
  url: string;
  /** このサイトに載せる内容 */
  content: string;
  /** 情報源が求める帰属表示 */
  attribution: string;
  licenseName?: string;
  licenseUrl?: string;
}

const TITLE_AND_LINK = "題名、公開日、公式情報へのリンク";
const FACTS = "バージョン番号、公開日、CVE の件数、公式情報へのリンク";

/** 情報源を追加するときは、利用条件を確認してここにも載せる */
export const SOURCE_CREDITS: Record<string, SourceCredit> = {
  kev: {
    name: "CISA Known Exploited Vulnerabilities Catalog",
    url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
    content: "製品名、CVE 番号、追加日、AI による日本語の要約",
    attribution: "Cybersecurity and Infrastructure Security Agency（CISA）",
    licenseName: "CC0 1.0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  },
  mozilla: {
    name: "Mozilla Security Blog",
    url: "https://blog.mozilla.org/security/",
    content: `認証局の事案の${TITLE_AND_LINK}`,
    attribution: "© 各執筆者（individual contributors）",
    licenseName: "Creative Commons（BY-SA）",
    licenseUrl:
      "https://www.mozilla.org/en-US/foundation/licensing/website-content/",
  },
  jpcert: {
    name: "JPCERT/CC",
    url: "https://www.jpcert.or.jp/",
    content: TITLE_AND_LINK,
    attribution: "一般社団法人 JPCERT コーディネーションセンター",
  },
  ipa: {
    name: "IPA",
    url: "https://www.ipa.go.jp/security/",
    content: TITLE_AND_LINK,
    attribution: "独立行政法人 情報処理推進機構（IPA）",
  },
  jvn: {
    name: "JVN",
    url: "https://jvn.jp/",
    content: TITLE_AND_LINK,
    attribution: "Japan Vulnerability Notes（JPCERT/CC、IPA）",
  },
  kubernetes: {
    name: "Kubernetes Official CVE Feed",
    url: "https://kubernetes.io/docs/reference/issues-security/official-cve-feed/",
    content: `${TITLE_AND_LINK}。題名は変更していません`,
    attribution: "© The Kubernetes Authors",
    licenseName: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  },
  chrome: {
    name: "Chrome Releases",
    url: "https://chromereleases.googleblog.com/",
    content: FACTS,
    attribution: "Google",
  },
  "windows-monthly": {
    name: "Windows 月例更新日",
    url: "https://msrc.microsoft.com/update-guide/",
    content:
      "取得していません。第2火曜の日付を計算し、公式情報へのリンクだけを載せています",
    attribution: "リンク先: Microsoft Security Update Guide",
  },
  "slack-windows": {
    name: "Slack リリースノート（Windows）",
    url: "https://slack.com/release-notes/windows",
    content: FACTS,
    attribution: "Slack",
  },
  "slack-mac": {
    name: "Slack リリースノート（Mac）",
    url: "https://slack.com/release-notes/mac",
    content: FACTS,
    attribution: "Slack",
  },
  nodejs: {
    name: "Node.js",
    url: "https://nodejs.org/",
    content: FACTS,
    attribution: "Copyright OpenJS Foundation and Node.js contributors",
  },
  php: {
    name: "PHP",
    url: "https://www.php.net/",
    content: FACTS,
    attribution: "Copyright © the PHP Group",
  },
  wordpress: {
    name: "WordPress",
    url: "https://wordpress.org/news/",
    content: FACTS,
    attribution: "WordPress.org。WordPress は WordPress Foundation の商標です",
  },
};

export interface OfficialLink {
  product: string;
  name: string;
  url: string;
}

/** 利用条件のため、自動で取得していない製品の公式情報 */
export const UNFETCHED_PRODUCTS: OfficialLink[] = [
  {
    product: "Windows / Office",
    name: "Microsoft Security Update Guide",
    url: "https://msrc.microsoft.com/update-guide/",
  },
  {
    product: "iPhone / Mac",
    name: "Apple セキュリティリリース",
    url: "https://support.apple.com/ja-jp/100100",
  },
  {
    product: "Cisco 製品",
    name: "Cisco Security Advisories",
    url: "https://sec.cloudapps.cisco.com/security/center/publicationListing.x",
  },
  {
    product: "Python",
    name: "Python Security",
    url: "https://www.python.org/dev/security/",
  },
];
