import type { Audience, Item, ProductId, Urgency } from "../pipeline/types.ts";
import { formatDate } from "./format.ts";
import { type ExploitationStatus, exploitationStatus } from "./notice.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

export const RECENT_DAYS = 7;

const PERIODS = ["7", "30", "all"] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_LABELS: Record<Period, string> = {
  "7": "直近7日",
  "30": "直近30日",
  all: "すべて（90日）",
};

export const AUDIENCE_LABELS: Record<Audience, string> = {
  both: "社員への周知あり",
  it: "情シスのみ",
};

/** 一覧に渡す最小限の形。全項目を渡すと、要約の分だけページが重くなる */
export interface ListRow {
  id: string;
  title: string;
  product: ProductId;
  publishedAt: string;
  date: string;
  urgency: Urgency;
  exploitation: ExploitationStatus;
  audience: Audience;
  cveCount: number;
  /** 語句の絞り込みに使う。CVE 番号でも探せるようにする */
  search: string;
}

export interface Filters {
  urgency: Urgency | "all";
  product: ProductId | "all";
  audience: Audience | "all";
  period: Period;
  query: string;
}

export const DEFAULT_FILTERS: Filters = {
  urgency: "all",
  product: "all",
  audience: "all",
  period: "all",
  query: "",
};

function normalize(text: string): string {
  return text.normalize("NFKC").toLowerCase();
}

export function toRow(item: Item): ListRow {
  return {
    id: item.id,
    title: item.title,
    product: item.product,
    publishedAt: item.publishedAt,
    date: formatDate(item.publishedAt),
    urgency: item.urgency,
    exploitation: exploitationStatus(item),
    audience: item.audience,
    cveCount: item.cveCount,
    search: normalize([item.title, ...item.cves].join(" ")),
  };
}

export function byNewest<T extends { publishedAt: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
  );
}

function isWithin(publishedAt: string, days: number, now: number): boolean {
  return Date.parse(publishedAt) >= now - days * DAY_MS;
}

/** 要対応が多いので、直近の要対応と要確認だけを先頭に出す */
export function priorityItems(items: Item[], now: number): Item[] {
  const recent = items.filter(
    (item) =>
      item.urgency !== "normal" && isWithin(item.publishedAt, RECENT_DAYS, now),
  );
  return [
    ...byNewest(recent.filter((item) => item.urgency === "action")),
    ...byNewest(recent.filter((item) => item.urgency === "review")),
  ];
}

export function filterRows(
  rows: ListRow[],
  filters: Filters,
  now: number,
): ListRow[] {
  const terms = normalize(filters.query).split(/\s+/).filter(Boolean);
  return rows.filter(
    (row) =>
      (filters.urgency === "all" || row.urgency === filters.urgency) &&
      (filters.product === "all" || row.product === filters.product) &&
      (filters.audience === "all" || row.audience === filters.audience) &&
      (filters.period === "all" ||
        isWithin(row.publishedAt, Number(filters.period), now)) &&
      terms.every((term) => row.search.includes(term)),
  );
}

function oneOf<T extends string>(
  value: string | null,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.find((candidate) => candidate === value) ?? fallback;
}

/** URL は共有されるので、知らない値は無視して初期値に戻す */
export function parseFilters(
  search: string,
  products: readonly ProductId[],
): Filters {
  const params = new URLSearchParams(search);
  return {
    urgency: oneOf<Filters["urgency"]>(
      params.get("urgency"),
      ["action", "review", "normal"],
      "all",
    ),
    product: oneOf<Filters["product"]>(params.get("product"), products, "all"),
    audience: oneOf<Filters["audience"]>(
      params.get("audience"),
      ["both", "it"],
      "all",
    ),
    period: oneOf<Period>(params.get("period"), PERIODS, "all"),
    query: params.get("q") ?? "",
  };
}

/** 初期値は URL に残さない */
export function filtersToSearch(filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.urgency !== "all") params.set("urgency", filters.urgency);
  if (filters.product !== "all") params.set("product", filters.product);
  if (filters.audience !== "all") params.set("audience", filters.audience);
  if (filters.period !== "all") params.set("period", filters.period);
  if (filters.query !== "") params.set("q", filters.query);
  const search = params.toString();
  return search ? `?${search}` : "";
}
