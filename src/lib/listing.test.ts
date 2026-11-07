import { describe, expect, it } from "vitest";
import type { Item, ProductId } from "../pipeline/types.ts";
import {
  byNewest,
  DEFAULT_FILTERS,
  filterRows,
  filtersToSearch,
  toRow as makeRow,
  parseFilters,
  priorityItems,
} from "./listing.ts";

const NOW = Date.parse("2026-11-07T12:00:00.000Z");

const item = (overrides: Partial<Item> = {}): Item => ({
  id: "1",
  source: "kev",
  product: "chrome",
  title: "Title",
  url: "https://example.com/",
  publishedAt: "2026-11-06T00:00:00.000Z",
  cves: [],
  cveCount: 0,
  exploited: false,
  urgency: "normal",
  urgencyReasons: [],
  audience: "both",
  treatment: "facts",
  ...overrides,
});

const PRODUCTS: ProductId[] = ["chrome", "cisco"];

const toRow = (entry: Item) => makeRow(entry, "CISA KEV");

describe("toRow", () => {
  it("情報源の名前を持つ", () => {
    expect(toRow(item()).source).toBe("CISA KEV");
  });

  it("日本時間の日付にする", () => {
    const row = toRow(item({ publishedAt: "2026-11-06T16:00:00.000Z" }));
    expect(row.date).toBe("2026/11/07");
  });

  it("関連する CVE の悪用を項目自体の悪用と分ける", () => {
    expect(toRow(item({ exploited: true })).exploitation).toBe("confirmed");
    expect(
      toRow(
        item({
          exploited: true,
          urgencyReasons: ["関連する CVE が KEV に掲載"],
        }),
      ).exploitation,
    ).toBe("related");
    expect(toRow(item()).exploitation).toBe("none");
  });

  it("要約を一覧の行に持ち込まない", () => {
    const row = toRow(
      item({ summary: { text: "長い要約の文章", origin: "ai" } }),
    );
    expect(JSON.stringify(row)).not.toContain("長い要約の文章");
  });
});

describe("byNewest", () => {
  it("新しい順に並べ、元の配列は変えない", () => {
    const old = item({ id: "old", publishedAt: "2026-10-01T00:00:00.000Z" });
    const fresh = item({ id: "new", publishedAt: "2026-11-01T00:00:00.000Z" });
    const input = [old, fresh];
    expect(byNewest(input).map((entry) => entry.id)).toEqual(["new", "old"]);
    expect(input[0]).toBe(old);
  });
});

describe("priorityItems", () => {
  it("直近7日の要対応を先に、要確認を後に並べる", () => {
    const items = [
      item({ id: "review-new", urgency: "review" }),
      item({
        id: "action-old",
        urgency: "action",
        publishedAt: "2026-11-02T00:00:00.000Z",
      }),
      item({ id: "action-new", urgency: "action" }),
      item({ id: "normal", urgency: "normal" }),
      item({
        id: "too-old",
        urgency: "action",
        publishedAt: "2026-10-30T00:00:00.000Z",
      }),
    ];
    expect(priorityItems(items, NOW).map((entry) => entry.id)).toEqual([
      "action-new",
      "action-old",
      "review-new",
    ]);
  });

  it("7日ちょうどの項目は含める", () => {
    const edge = item({
      urgency: "action",
      publishedAt: "2026-10-31T12:00:00.000Z",
    });
    expect(priorityItems([edge], NOW)).toHaveLength(1);
  });
});

describe("filterRows", () => {
  const rows = [
    toRow(item({ id: "a", urgency: "action", product: "cisco" })),
    toRow(
      item({
        id: "b",
        urgency: "review",
        audience: "it",
        publishedAt: "2026-09-20T00:00:00.000Z",
      }),
    ),
    toRow(
      item({ id: "c", title: "Chrome Ｓｔａｂｌｅ", cves: ["CVE-2026-1"] }),
    ),
  ];
  const ids = (filters: Partial<typeof DEFAULT_FILTERS>) =>
    filterRows(rows, { ...DEFAULT_FILTERS, ...filters }, NOW).map(
      (row) => row.id,
    );

  it("初期値では全件を返す", () => {
    expect(ids({})).toEqual(["a", "b", "c"]);
  });

  it("緊急度、製品、読者、期間で絞り込む", () => {
    expect(ids({ urgency: "action" })).toEqual(["a"]);
    expect(ids({ product: "cisco" })).toEqual(["a"]);
    expect(ids({ audience: "it" })).toEqual(["b"]);
    expect(ids({ period: "7" })).toEqual(["a", "c"]);
    expect(ids({ period: "30" })).toEqual(["a", "c"]);
  });

  it("語句は大文字小文字と全角半角を区別せず、CVE 番号でも探せる", () => {
    expect(ids({ query: "chrome stable" })).toEqual(["c"]);
    expect(ids({ query: "cve-2026-1" })).toEqual(["c"]);
    expect(ids({ query: "chrome missing" })).toEqual([]);
  });

  it("語句が空白だけなら絞り込まない", () => {
    expect(ids({ query: "   " })).toEqual(["a", "b", "c"]);
  });
});

describe("URL の条件", () => {
  it("書き出した条件を読み戻せる", () => {
    const filters = {
      urgency: "action",
      product: "cisco",
      audience: "it",
      period: "30",
      query: "CVE 2026&x=1",
    } as const;
    expect(parseFilters(filtersToSearch(filters), PRODUCTS)).toEqual(filters);
  });

  it("初期値は URL に残さない", () => {
    expect(filtersToSearch(DEFAULT_FILTERS)).toBe("");
  });

  it("知らない値は初期値に戻す", () => {
    expect(
      parseFilters("?urgency=x&product=apple&audience=y&period=9", PRODUCTS),
    ).toEqual(DEFAULT_FILTERS);
  });
});
