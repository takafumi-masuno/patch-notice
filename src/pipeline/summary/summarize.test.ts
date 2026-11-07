import { describe, expect, it, vi } from "vitest";
import type { Item } from "../types.ts";
import type { Summarizer, SummaryResult } from "./client.ts";
import { parseOverrides } from "./overrides.ts";
import {
  attachSummaries,
  MAX_ATTEMPTS,
  type SummaryStore,
  sourcesNeedingBody,
  summarizeItems,
} from "./summarize.ts";

const now = new Date("2026-11-07T00:00:00Z");

const item = (id: string, overrides: Partial<Item> = {}): Item => ({
  id,
  source: "kev",
  product: "other",
  title: "Title",
  url: "https://example.com/",
  publishedAt: "2026-11-01T00:00:00.000Z",
  cves: [],
  cveCount: 0,
  exploited: false,
  urgency: "normal",
  urgencyReasons: [],
  audience: "it",
  treatment: "ai-summary",
  ...overrides,
});

const TEXT = "この製品には問題があり、攻撃者が操作できるおそれがあります。";

const success: SummaryResult = {
  kind: "ok",
  text: TEXT,
  model: "claude-sonnet-5-5",
  costUsd: 0.01,
};

const always = (result: SummaryResult) => vi.fn<Summarizer>(async () => result);

const run = (
  items: Item[],
  summarize: Summarizer,
  options: {
    bodies?: Map<string, string>;
    store?: SummaryStore;
    overrides?: Record<string, { summary: string | null; reason: string }>;
    limits?: { maxCostUsd: number; maxItems: number };
  } = {},
) =>
  summarizeItems({
    items,
    bodies: options.bodies ?? new Map(items.map((entry) => [entry.id, "Body"])),
    store: options.store ?? {},
    overrides: options.overrides ?? {},
    summarize,
    now,
    ...(options.limits ? { limits: options.limits } : {}),
  });

describe("summarizeItems", () => {
  it("要約を保存し、結果を集計する", async () => {
    const { store, status } = await run([item("a")], always(success));
    expect(store.a).toMatchObject({
      attempts: 1,
      text: TEXT,
      model: "claude-sonnet-5-5",
      generatedAt: now.toISOString(),
    });
    expect(status).toMatchObject({
      requested: 1,
      summarized: 1,
      pending: 0,
      costUsd: 0.01,
    });
    expect(status.stopped).toBeUndefined();
  });

  it("保存データに本文を含めない", async () => {
    const body = "本文の全文 Body text";
    const { store } = await run([item("a")], always(success), {
      bodies: new Map([["a", body]]),
    });
    expect(JSON.stringify(store)).not.toContain(body);
  });

  it("AI の対象外には API を呼ばない", async () => {
    const summarize = always(success);
    await run([item("a", { treatment: "facts" })], summarize);
    expect(summarize).not.toHaveBeenCalled();
  });

  it("本文が同じなら2回目は API を呼ばない", async () => {
    const first = await run([item("a")], always(success));
    const summarize = always(success);
    const second = await run([item("a")], summarize, { store: first.store });
    expect(summarize).not.toHaveBeenCalled();
    expect(second.store.a.text).toBe(TEXT);
  });

  it("本文が今回取得できなくても要約を残す", async () => {
    const first = await run([item("a")], always(success));
    const second = await run([item("a")], always(success), {
      bodies: new Map(),
      store: first.store,
    });
    expect(second.store.a.text).toBe(TEXT);
  });

  it("本文が変わったら作り直す", async () => {
    const first = await run([item("a")], always(success));
    const summarize = always(success);
    await run([item("a")], summarize, {
      bodies: new Map([["a", "Changed"]]),
      store: first.store,
    });
    expect(summarize).toHaveBeenCalledOnce();
  });

  it("悪用の判定が変わっても、本文が同じなら作り直さない", async () => {
    const first = await run([item("a")], always(success));
    const summarize = always(success);
    await run([item("a", { exploited: true })], summarize, {
      store: first.store,
    });
    expect(summarize).not.toHaveBeenCalled();
  });

  it("本文が変わって作り直せなければ古い要約を残さない", async () => {
    const first = await run([item("a")], always(success));
    const { store } = await run(
      [item("a")],
      always({
        kind: "error",
        message: "500",
        stopRun: false,
        fatal: false,
      }),
      { bodies: new Map([["a", "Changed"]]), store: first.store },
    );
    expect(store.a).toBeUndefined();
  });

  it("期間外になった項目の保存データを消す", async () => {
    const { store } = await run([], always(success), {
      store: { old: { hash: "x", attempts: 1, text: TEXT } },
    });
    expect(store).toEqual({});
  });

  it("検証に落ちた要約は保存せず、理由を残す", async () => {
    const { store, status } = await run(
      [item("a")],
      always({
        ...success,
        text: "更新してください。問題があります。対応を。",
      }),
    );
    expect(store.a.text).toBeUndefined();
    expect(store.a.failure).toContain("advice");
    expect(status).toMatchObject({ rejected: 1, pending: 1 });
  });

  it("検証に落ち続けたら上限で諦める", async () => {
    const bad: SummaryResult = { ...success, text: "短い" };
    let store: SummaryStore = {};
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      store = (await run([item("a")], always(bad), { store })).store;
    }
    const summarize = always(bad);
    const { status } = await run([item("a")], summarize, { store });
    expect(summarize).not.toHaveBeenCalled();
    expect(status.pending).toBe(0);
  });

  it("拒否された項目は再度送らない", async () => {
    const first = await run(
      [item("a")],
      always({ kind: "refused", reason: "refusal:cyber", costUsd: 0 }),
    );
    expect(first.store.a.failure).toBe("refusal:cyber");
    expect(first.status).toMatchObject({ refused: 1, pending: 0 });
    const summarize = always(success);
    await run([item("a")], summarize, { store: first.store });
    expect(summarize).not.toHaveBeenCalled();
  });

  it("応答が使えなければ次回に再度送る", async () => {
    const { store, status } = await run(
      [item("a")],
      always({ kind: "invalid", reason: "stop:max_tokens", costUsd: 0.01 }),
    );
    expect(store.a.attempts).toBe(1);
    expect(status).toMatchObject({ rejected: 1, pending: 1, costUsd: 0.01 });
  });

  it("一時的な失敗は回数に数えず、処理を続ける", async () => {
    const summarize = always({
      kind: "error",
      message: "500",
      stopRun: false,
      fatal: false,
    });
    const { store, status } = await run([item("a"), item("b")], summarize);
    expect(summarize).toHaveBeenCalledTimes(2);
    expect(store.a).toBeUndefined();
    expect(status).toMatchObject({ errors: 2, pending: 2 });
    expect(status.stopped).toBeUndefined();
  });

  it("致命的な失敗は処理を止めて呼び出し元に返す", async () => {
    const items = Array.from({ length: 10 }, (_, i) => item(String(i)));
    const summarize = always({
      kind: "error",
      message: "401: invalid",
      stopRun: true,
      fatal: true,
    });
    const result = await run(items, summarize);
    expect(result.fatalError).toBe("401: invalid");
    expect(result.status.stopped).toContain("401");
    expect(summarize.mock.calls.length).toBeLessThan(items.length);
  });

  it("費用の上限に達したら止めて、残りを要約待ちにする", async () => {
    const items = Array.from({ length: 20 }, (_, i) => item(String(i)));
    const summarize = always(success);
    const { status } = await run(items, summarize, {
      limits: { maxCostUsd: 0.05, maxItems: 100 },
    });
    expect(status.stopped).toBe("cost-limit");
    expect(summarize.mock.calls.length).toBeLessThan(items.length);
    expect(status.pending).toBe(items.length - status.summarized);
  });

  it("1回の件数の上限を超えて送らない", async () => {
    const items = Array.from({ length: 5 }, (_, i) => item(String(i)));
    const summarize = always(success);
    const { status } = await run(items, summarize, {
      limits: { maxCostUsd: 100, maxItems: 2 },
    });
    expect(summarize).toHaveBeenCalledTimes(2);
    expect(status.pending).toBe(3);
  });

  it("手動で差し替えた項目は API を呼ばない", async () => {
    const summarize = always(success);
    await run([item("a")], summarize, {
      overrides: { a: { summary: "手動", reason: "誤りの修正" } },
    });
    expect(summarize).not.toHaveBeenCalled();
  });
});

describe("sourcesNeedingBody", () => {
  it("要約待ちの項目がある情報源だけを返す", () => {
    const store: SummaryStore = {
      done: { hash: "x", attempts: 1, text: TEXT },
      gaveUp: { hash: "x", attempts: MAX_ATTEMPTS },
      retry: { hash: "x", attempts: 1 },
    };
    const needs = sourcesNeedingBody(
      [
        item("done", { source: "done" }),
        item("gaveUp", { source: "gaveUp" }),
        item("retry", { source: "retry" }),
        item("new", { source: "new" }),
        item("facts", { source: "facts", treatment: "facts" }),
        item("manual", { source: "manual" }),
      ],
      store,
      { manual: { summary: "手動", reason: "修正" } },
    );
    expect([...needs].sort()).toEqual(["new", "retry"]);
  });
});

describe("attachSummaries", () => {
  it("保存した要約を項目に付ける", () => {
    const [attached] = attachSummaries(
      [item("a")],
      {
        a: {
          hash: "x",
          attempts: 1,
          text: TEXT,
          model: "claude-sonnet-5",
          generatedAt: now.toISOString(),
        },
      },
      {},
    );
    expect(attached.summary).toEqual({
      text: TEXT,
      origin: "ai",
      model: "claude-sonnet-5",
      generatedAt: now.toISOString(),
    });
  });

  it("保存データにない前回の要約を残さない", () => {
    const [attached] = attachSummaries(
      [item("a", { summary: { text: "古い", origin: "ai" } })],
      {},
      {},
    );
    expect(attached.summary).toBeUndefined();
  });

  it("手動の差し替えを AI の要約より優先する", () => {
    const [attached] = attachSummaries(
      [item("a")],
      { a: { hash: "x", attempts: 1, text: TEXT } },
      { a: { summary: "手動の要約", reason: "誤りの修正" } },
    );
    expect(attached.summary).toEqual({ text: "手動の要約", origin: "manual" });
  });

  it("summary が null なら要約を出さない", () => {
    const [attached] = attachSummaries(
      [item("a")],
      { a: { hash: "x", attempts: 1, text: TEXT } },
      { a: { summary: null, reason: "内容に問題がある" } },
    );
    expect(attached.summary).toBeUndefined();
  });
});

describe("parseOverrides", () => {
  it("正しい形を受け取る", () => {
    const value = {
      a: { summary: "修正", reason: "誤り" },
      b: { summary: null, reason: "非表示" },
    };
    expect(parseOverrides(value)).toEqual(value);
  });

  it.each([
    [[], "must be an object"],
    [{ a: { summary: 1, reason: "x" } }, "summary"],
    [{ a: { reason: "x" } }, "summary"],
    [{ a: { summary: null } }, "reason"],
    [{ a: { summary: null, reason: "" } }, "reason"],
    [{ a: null }, "summary"],
  ])("形が崩れていたら止める: %j", (value, message) => {
    expect(() => parseOverrides(value)).toThrow(message);
  });
});
