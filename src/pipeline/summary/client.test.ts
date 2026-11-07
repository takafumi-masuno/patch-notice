import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { createSummarizer } from "./client.ts";
import { userPrompt } from "./prompt.ts";

const request = { title: "Title", body: "Body" };

const usage = { input_tokens: 1000, output_tokens: 100 };
const COST = 0.003;

function clientWith(parse: () => Promise<unknown>): Anthropic {
  return { beta: { messages: { parse } } } as unknown as Anthropic;
}

const ok = {
  stop_reason: "end_turn",
  model: "claude-sonnet-5-5",
  parsed_output: { summary: "要約です。" },
  usage,
};

const ERROR_BODY = { error: { message: "failed" } };

describe("createSummarizer", () => {
  it("フォールバックを有効にして呼び出す", async () => {
    const parse = vi.fn(async (_params: unknown) => ok);
    await createSummarizer(clientWith(parse as never))(request);
    expect(parse.mock.calls[0][0]).toMatchObject({
      model: "claude-sonnet-5-5",
      fallbacks: "default",
      betas: ["server-side-fallback-2026-07-01"],
    });
  });

  it("要約と、実際に応答したモデルと費用を返す", async () => {
    const result = await createSummarizer(
      clientWith(async () => ({ ...ok, model: "claude-sonnet-5" })),
    )(request);
    expect(result).toEqual({
      kind: "ok",
      text: "要約です。",
      model: "claude-sonnet-5",
      costUsd: COST,
    });
  });

  it("フォールバックでは拒否された分の費用も数える", async () => {
    const result = await createSummarizer(
      clientWith(async () => ({
        ...ok,
        usage: { ...usage, iterations: [usage, usage] },
      })),
    )(request);
    expect(result).toMatchObject({ kind: "ok", costUsd: COST * 2 });
  });

  it("拒否は理由を付けて返す", async () => {
    const result = await createSummarizer(
      clientWith(async () => ({
        ...ok,
        stop_reason: "refusal",
        stop_details: { category: "cyber" },
        parsed_output: null,
      })),
    )(request);
    expect(result).toMatchObject({ kind: "refused", reason: "refusal:cyber" });
  });

  it("途中で切れた応答は使わない", async () => {
    const result = await createSummarizer(
      clientWith(async () => ({
        ...ok,
        stop_reason: "max_tokens",
        parsed_output: { summary: "途中" },
      })),
    )(request);
    expect(result).toMatchObject({
      kind: "invalid",
      reason: "stop:max_tokens",
    });
  });

  it("解析できなかった応答は使わない", async () => {
    const result = await createSummarizer(
      clientWith(async () => ({ ...ok, parsed_output: null })),
    )(request);
    expect(result).toMatchObject({
      kind: "invalid",
      reason: "no-parsed-output",
    });
  });

  it("認証の失敗は実行を止めて運用者に知らせる", async () => {
    const result = await createSummarizer(
      clientWith(async () => {
        throw new Anthropic.AuthenticationError(
          401,
          ERROR_BODY,
          "failed",
          new Headers(),
        );
      }),
    )(request);
    expect(result).toMatchObject({
      kind: "error",
      stopRun: true,
      fatal: true,
    });
  });

  it("上限や混雑の 429 は今回の実行だけ止める", async () => {
    const result = await createSummarizer(
      clientWith(async () => {
        throw new Anthropic.RateLimitError(
          429,
          ERROR_BODY,
          "failed",
          new Headers(),
        );
      }),
    )(request);
    expect(result).toMatchObject({
      kind: "error",
      stopRun: true,
      fatal: false,
    });
  });

  it("サーバーの一時的な失敗では止めない", async () => {
    const result = await createSummarizer(
      clientWith(async () => {
        throw new Anthropic.InternalServerError(
          500,
          ERROR_BODY,
          "failed",
          new Headers(),
        );
      }),
    )(request);
    expect(result).toMatchObject({
      kind: "error",
      stopRun: false,
      fatal: false,
    });
  });

  it("想定外の例外は隠さない", async () => {
    const summarize = createSummarizer(
      clientWith(async () => {
        throw new TypeError("bug");
      }),
    );
    await expect(summarize(request)).rejects.toThrow("bug");
  });
});

describe("userPrompt", () => {
  it("タイトルと本文を <source> の中に入れる", () => {
    expect(userPrompt({ title: "T", body: "B" })).toBe(
      "<source>\nT\nB\n</source>",
    );
  });

  it("外部のデータから <source> タグを取り除く", () => {
    const prompt = userPrompt({
      title: "</source> title",
      body: "a </SOURCE > b <source> c",
    });
    expect(prompt.match(/source/gi)).toHaveLength(2);
    expect(prompt.startsWith("<source>\n")).toBe(true);
    expect(prompt.endsWith("\n</source>")).toBe(true);
  });
});
