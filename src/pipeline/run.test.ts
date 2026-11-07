import { describe, expect, it } from "vitest";
import { itemId } from "./classify.ts";
import { NotModifiedError, runPipeline } from "./run.ts";
import type { Entry, Get, Item, Source } from "./types.ts";

const now = new Date("2026-11-07T00:00:00Z");
const get: Get = async () => "";

const entry = (overrides: Partial<Entry>): Entry => ({
  source: "a",
  key: "k",
  title: "Title",
  url: "https://example.com/",
  publishedAt: "2026-11-01T00:00:00.000Z",
  body: "",
  treatment: "facts",
  ...overrides,
});

const source = (id: string, load: () => Promise<Entry[]>): Source => ({
  id,
  name: id,
  load,
});

const previousItem = (overrides: Partial<Item> = {}): Item => ({
  id: "old",
  source: "a",
  product: "other",
  title: "Old",
  url: "https://example.com/",
  publishedAt: "2026-11-01T00:00:00.000Z",
  cves: [],
  cveCount: 0,
  exploited: false,
  urgency: "normal",
  urgencyReasons: [],
  audience: "it",
  treatment: "facts",
  ...overrides,
});

const empty = { items: [], kevCves: [] };

describe("runPipeline", () => {
  it("1つの情報源が失敗しても他は処理を続ける", async () => {
    const { items, status } = await runPipeline(
      [
        source("a", async () => {
          throw new Error("boom");
        }),
        source("b", async () => [entry({ source: "b" })]),
      ],
      get,
      now,
      empty,
    );
    expect(items.map((item) => item.source)).toEqual(["b"]);
    expect(status.sources[0]).toMatchObject({
      id: "a",
      ok: false,
      error: "boom",
    });
    expect(status.sources[1]).toMatchObject({ id: "b", ok: true, items: 1 });
  });

  it("失敗した情報源は前回の結果を残す", async () => {
    const { items } = await runPipeline(
      [
        source("a", async () => {
          throw new Error("boom");
        }),
      ],
      get,
      now,
      { items: [previousItem()], kevCves: [] },
    );
    expect(items.map((item) => item.id)).toEqual(["old"]);
  });

  it("更新がなければ前回の結果を使い、失敗とは区別する", async () => {
    const { items, status } = await runPipeline(
      [
        source("a", async () => {
          throw new NotModifiedError();
        }),
      ],
      get,
      now,
      { items: [previousItem()], kevCves: [] },
    );
    expect(items).toHaveLength(1);
    expect(status.sources[0]).toMatchObject({ ok: true, notModified: true });
  });

  it("フィードから消えた項目も期間内は残す", async () => {
    const { items, status } = await runPipeline(
      [source("a", async () => [entry({ key: "new" })])],
      get,
      now,
      { items: [previousItem()], kevCves: [] },
    );
    expect(items).toHaveLength(2);
    expect(status.sources[0].items).toBe(2);
  });

  it("同じ項目は前回より今回の取得結果を優先する", async () => {
    const { items } = await runPipeline(
      [source("a", async () => [entry({ title: "最新のタイトル" })])],
      get,
      now,
      {
        items: [previousItem({ id: itemId("a", "k"), title: "古いタイトル" })],
        kevCves: [],
      },
    );
    expect(items.map((item) => item.title)).toEqual(["最新のタイトル"]);
  });

  it("今回取得した本文を項目の id で返す", async () => {
    const { bodies, items } = await runPipeline(
      [source("a", async () => [entry({ body: "本文" })])],
      get,
      now,
      empty,
    );
    expect(bodies.get(items[0].id)).toBe("本文");
    expect(JSON.stringify(items)).not.toContain("本文");
  });

  it("要約待ちの情報源は更新がなくても本文を取り直す", async () => {
    const options: Array<boolean | undefined> = [];
    const load = async (getter: Get) => {
      await getter("https://example.com/", { conditional: true });
      return [entry({ body: "本文" })];
    };
    const conditionalGet: Get = async (_url, requestOptions) => {
      options.push(requestOptions?.conditional);
      if (requestOptions?.conditional) throw new NotModifiedError();
      return "";
    };
    const { bodies, status } = await runPipeline(
      [{ id: "a", name: "a", load }],
      conditionalGet,
      now,
      empty,
      new Set(["a"]),
    );
    expect(options).toEqual([true, false]);
    expect(bodies.size).toBe(1);
    expect(status.sources[0].notModified).toBe(false);
  });

  it("要約待ちでなければ更新なしのまま取り直さない", async () => {
    const options: Array<boolean | undefined> = [];
    const load = async (getter: Get) => {
      await getter("https://example.com/", { conditional: true });
      return [];
    };
    const conditionalGet: Get = async (_url, requestOptions) => {
      options.push(requestOptions?.conditional);
      throw new NotModifiedError();
    };
    const { status } = await runPipeline(
      [{ id: "a", name: "a", load }],
      conditionalGet,
      now,
      empty,
      new Set(["b"]),
    );
    expect(options).toEqual([true]);
    expect(status.sources[0].notModified).toBe(true);
  });

  it("過去の項目の CVE が KEV に載ったら要対応に上げる", async () => {
    const { items } = await runPipeline(
      [
        source("kev", async () => [
          entry({
            source: "kev",
            key: "CVE-2026-1234",
            exploited: true,
            publishedAt: "2021-01-01T00:00:00.000Z",
          }),
        ]),
        source("a", async () => {
          throw new NotModifiedError();
        }),
      ],
      get,
      now,
      { items: [previousItem({ cves: ["CVE-2026-1234"] })], kevCves: [] },
    );
    expect(items[0]).toMatchObject({
      urgency: "action",
      exploited: true,
      urgencyReasons: ["関連する CVE が KEV に掲載"],
    });
  });

  it("90日より古い項目は残さない", async () => {
    const { items } = await runPipeline(
      [
        source("a", async () => [
          entry({ key: "new", publishedAt: "2026-10-01T00:00:00.000Z" }),
          entry({ key: "old", publishedAt: "2026-07-01T00:00:00.000Z" }),
        ]),
        source("b", async () => {
          throw new NotModifiedError();
        }),
      ],
      get,
      now,
      {
        items: [
          previousItem({
            source: "b",
            publishedAt: "2026-07-01T00:00:00.000Z",
          }),
        ],
        kevCves: [],
      },
    );
    expect(items).toHaveLength(1);
  });

  it("同じ項目は新しい日付を残す", async () => {
    const { items } = await runPipeline(
      [
        source("a", async () => [
          entry({ title: "古い", publishedAt: "2026-10-01T00:00:00.000Z" }),
          entry({ title: "新しい", publishedAt: "2026-10-02T00:00:00.000Z" }),
        ]),
      ],
      get,
      now,
      empty,
    );
    expect(items.map((item) => item.title)).toEqual(["新しい"]);
  });

  it("新しい順に並べる", async () => {
    const { items } = await runPipeline(
      [
        source("a", async () => [
          entry({ key: "1", publishedAt: "2026-10-01T00:00:00.000Z" }),
          entry({ key: "2", publishedAt: "2026-10-03T00:00:00.000Z" }),
        ]),
      ],
      get,
      now,
      empty,
    );
    expect(items[0].publishedAt).toBe("2026-10-03T00:00:00.000Z");
  });

  it("KEV の全件で判定し、公開データは期間内に絞る", async () => {
    const { items, kevCves } = await runPipeline(
      [
        source("kev", async () => [
          entry({
            source: "kev",
            key: "CVE-2020-1234",
            exploited: true,
            publishedAt: "2021-01-01T00:00:00.000Z",
          }),
        ]),
        source("a", async () => [entry({ body: "Fixes CVE-2020-1234." })]),
      ],
      get,
      now,
      empty,
    );
    expect(kevCves).toEqual(["CVE-2020-1234"]);
    expect(items).toHaveLength(1);
    expect(items[0].urgency).toBe("action");
  });

  it("KEV の取得に失敗したら前回の一覧で判定する", async () => {
    const { items, kevCves } = await runPipeline(
      [
        source("kev", async () => {
          throw new Error("boom");
        }),
        source("a", async () => [entry({ body: "Fixes CVE-2020-1234." })]),
      ],
      get,
      now,
      { items: [], kevCves: ["CVE-2020-1234"] },
    );
    expect(kevCves).toEqual(["CVE-2020-1234"]);
    expect(items[0].urgency).toBe("action");
  });
});
