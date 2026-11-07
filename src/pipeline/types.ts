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
  /** CVE を列挙しない項目の件数 */
  cveCount?: number;
  /** 毎月の定例の更新日。内容を取得していないので、緊急度は要確認に留める */
  monthlyUpdate?: boolean;
}

/** 画面に出す要約 */
export interface Summary {
  text: string;
  /** ai: AI の生成、manual: 手動の差し替え */
  origin: "ai" | "manual";
  /** 実際に応答したモデル。フォールバックすると指定と異なる */
  model?: string;
  generatedAt?: string;
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
  summary?: Summary;
}

export type Get = (
  url: string,
  options?: { conditional?: boolean },
) => Promise<string>;

export interface Source {
  id: string;
  name: string;
  /** 通信しない情報源。全情報源の失敗の判定と取得時刻の更新に数えない */
  offline?: boolean;
  load(get: Get, now: Date): Promise<Entry[]>;
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

/** AI 要約の実行結果 */
export interface AiStatus {
  /** 今回 API に送った件数 */
  requested: number;
  summarized: number;
  /** 検証で不採用にした件数 */
  rejected: number;
  refused: number;
  errors: number;
  /** 要約待ちのまま残った件数 */
  pending: number;
  costUsd: number;
  /** 途中で止めた理由。最後まで処理したら省く */
  stopped?: string;
}

export interface Status {
  fetchedAt: string;
  sources: SourceStatus[];
  ai?: AiStatus;
}
