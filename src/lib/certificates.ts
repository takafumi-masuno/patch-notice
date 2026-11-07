import raw from "../content/certificates.json" with { type: "json" };
import { formatDate } from "./format.ts";
import { isHttpsUrl } from "./site.ts";

export type CertificateScope = "device" | "server";
/** expiry: 証明書の有効期限、rule: 業界ルールの適用日 */
export type CertificateKind = "expiry" | "rule";
export type DeadlineState = "next" | "upcoming" | "applied" | "expired";

export interface CertificateDeadline {
  id: string;
  /** YYYY-MM-DD。公式情報を見て手で登録する */
  date: string;
  kind: CertificateKind;
  scope: CertificateScope;
  title: string;
  detail: string;
  action: string;
  sourceName: string;
  sourceUrl: string;
  /** 公式情報を確認した日 */
  checkedAt: string;
}

export const SCOPE_LABELS: Record<CertificateScope, string> = {
  device: "端末",
  server: "サーバー",
};

export const DEADLINE_STATE_LABELS: Record<DeadlineState, string> = {
  next: "次の期限",
  upcoming: "予定",
  applied: "適用済み",
  expired: "期限経過",
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 手で登録するデータなので、誤りはビルドで止める */
export function parseDeadlines(input: unknown): CertificateDeadline[] {
  if (!Array.isArray(input)) throw new Error("期限の一覧が配列ではありません");
  const deadlines = input as CertificateDeadline[];
  for (const entry of deadlines) {
    if (!DATE_PATTERN.test(entry.date) || !DATE_PATTERN.test(entry.checkedAt)) {
      throw new Error(`${entry.id}: 日付の形式が正しくありません`);
    }
    if (!isHttpsUrl(entry.sourceUrl)) {
      throw new Error(`${entry.id}: 公式情報の URL が https ではありません`);
    }
    if (!entry.title || !entry.detail || !entry.action || !entry.sourceName) {
      throw new Error(`${entry.id}: 空の欄があります`);
    }
  }
  return [...deadlines].sort((a, b) => a.date.localeCompare(b.date));
}

export const CERTIFICATE_DEADLINES = parseDeadlines(raw);

function today(now: number): string {
  return formatDate(new Date(now).toISOString()).replaceAll("/", "-");
}

export function nextDeadline(
  deadlines: CertificateDeadline[],
  now: number,
): CertificateDeadline | undefined {
  const current = today(now);
  return deadlines.find((entry) => entry.date >= current);
}

export function deadlineState(
  entry: CertificateDeadline,
  deadlines: CertificateDeadline[],
  now: number,
): DeadlineState {
  if (entry.date >= today(now)) {
    return nextDeadline(deadlines, now)?.id === entry.id ? "next" : "upcoming";
  }
  return entry.kind === "rule" ? "applied" : "expired";
}

/** 残りの期限を先に出し、経過した項目は新しい順で後ろへ回す */
export function groupDeadlines(
  deadlines: CertificateDeadline[],
  now: number,
): { upcoming: CertificateDeadline[]; past: CertificateDeadline[] } {
  const current = today(now);
  return {
    upcoming: deadlines.filter((entry) => entry.date >= current),
    past: deadlines.filter((entry) => entry.date < current).reverse(),
  };
}
