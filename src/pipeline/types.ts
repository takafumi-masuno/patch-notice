/** 緊急度。action: 要対応、review: 要確認、normal: 通常 */
export type Urgency = "action" | "review" | "normal";

/** both: 社員向けと情シス向け、it: 情シス向けのみ */
export type Audience = "both" | "it";

/** ai-summary: AI 要約の候補、title-link: タイトルとリンク、facts: 事実と定型文、version-link: バージョン名とリンク */
export type Treatment = "ai-summary" | "title-link" | "facts" | "version-link";

export type ProductId =
  | "windows-office"
  | "apple"
  | "chrome"
  | "slack"
  | "nodejs"
  | "php"
  | "python"
  | "java"
  | "cisco"
  | "fortinet"
  | "paloalto"
  | "ivanti"
  | "oracle"
  | "aws"
  | "adobe"
  | "citrix"
  | "kubernetes"
  | "wordpress"
  | "ca-incident"
  | "other";

export type VendorSeverity = "critical" | "high" | "medium" | "low" | "info";

/** 情報源から取り出した1件。本文は判定と要約にだけ使い、公開データには保存しない。 */
export interface Entry {
  source: string;
  /** 情報源の中で一意な値 */
  key: string;
  title: string;
  url: string;
  publishedAt: string;
  body: string;
  treatment: Treatment;
  /** 情報源が製品を決めている場合に指定する。省略時は本文から判定する */
  product?: ProductId;
  version?: string;
  vendorSeverity?: VendorSeverity;
  /** 情報源のデータ自体が悪用を示している（KEV など） */
  exploited?: boolean;
  /** 国内機関の注意喚起 */
  nationalAlert?: boolean;
  /** 月例更新のように CVE を列挙しない項目の件数 */
  cveCount?: number;
}

/** 公開データの1件 */
export interface Item {
  id: string;
  source: string;
  product: ProductId;
  title: string;
  url: string;
  publishedAt: string;
  cves: string[];
  cveCount: number;
  exploited: boolean;
  urgency: Urgency;
  urgencyReasons: string[];
  audience: Audience;
  treatment: Treatment;
  version?: string;
  vendorSeverity?: VendorSeverity;
}

export type Get = (
  url: string,
  options?: { conditional?: boolean; accept?: string },
) => Promise<string>;

export interface Source {
  id: string;
  name: string;
  load(get: Get): Promise<Entry[]>;
}

export interface SourceStatus {
  id: string;
  name: string;
  ok: boolean;
  /** 取得したが更新がなく、前回の結果を使った */
  notModified: boolean;
  entries: number;
  items: number;
  error?: string;
}

export interface Status {
  fetchedAt: string;
  sources: SourceStatus[];
}
