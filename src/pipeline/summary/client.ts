import Anthropic from "@anthropic-ai/sdk";
import { betaJSONSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import { SYSTEM_PROMPT, userPrompt } from "./prompt.ts";

const MODEL = "claude-sonnet-5-5";
const MAX_TOKENS = 2000;
// Sonnet 5.5 と、フォールバック先の Sonnet 5 は同じ価格
const USD_PER_INPUT_TOKEN = 2 / 1_000_000;
const USD_PER_OUTPUT_TOKEN = 10 / 1_000_000;

const OUTPUT_FORMAT = betaJSONSchemaOutputFormat({
  type: "object",
  properties: { summary: { type: "string" } },
  required: ["summary"],
  additionalProperties: false,
});

export interface SummaryRequest {
  title: string;
  body: string;
  exploited: boolean;
}

export type SummaryResult =
  | { kind: "ok"; text: string; model: string; costUsd: number }
  | { kind: "refused"; reason: string; costUsd: number }
  | { kind: "invalid"; reason: string; costUsd: number }
  | { kind: "error"; message: string; stopRun: boolean; fatal: boolean };

export type Summarizer = (request: SummaryRequest) => Promise<SummaryResult>;

interface Tokens {
  input_tokens: number;
  output_tokens: number;
}

/** フォールバックすると拒否された分も課金されるので、応答ごとの内訳を合計する */
function costOf(usage: Tokens & { iterations?: Tokens[] | null }): number {
  const parts = usage.iterations?.length ? usage.iterations : [usage];
  return parts.reduce(
    (total, part) =>
      total +
      part.input_tokens * USD_PER_INPUT_TOKEN +
      part.output_tokens * USD_PER_OUTPUT_TOKEN,
    0,
  );
}

function toErrorResult(error: unknown): SummaryResult {
  if (
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError ||
    error instanceof Anthropic.BadRequestError ||
    error instanceof Anthropic.NotFoundError
  ) {
    // 設定の問題は同じ失敗を繰り返すので、すぐ止めて運用者に知らせる
    return {
      kind: "error",
      message: `${error.status}: ${error.message}`,
      stopRun: true,
      fatal: true,
    };
  }
  if (error instanceof Anthropic.RateLimitError) {
    return {
      kind: "error",
      message: `${error.status}: ${error.message}`,
      stopRun: true,
      fatal: false,
    };
  }
  if (error instanceof Anthropic.APIError) {
    return {
      kind: "error",
      message: `${error.status ?? "connection"}: ${error.message}`,
      stopRun: false,
      fatal: false,
    };
  }
  throw error;
}

export function createSummarizer(client: Anthropic): Summarizer {
  return async (request) => {
    try {
      const response = await client.beta.messages.parse({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low", format: OUTPUT_FORMAT },
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt(request) }],
      });
      const costUsd = costOf(response.usage);
      if (response.stop_reason === "refusal") {
        const category = response.stop_details?.category ?? "unknown";
        return { kind: "refused", reason: `refusal:${category}`, costUsd };
      }
      if (response.stop_reason !== "end_turn") {
        return {
          kind: "invalid",
          reason: `stop:${response.stop_reason}`,
          costUsd,
        };
      }
      const text = response.parsed_output?.summary;
      if (typeof text !== "string") {
        return { kind: "invalid", reason: "no-parsed-output", costUsd };
      }
      return { kind: "ok", text, model: response.model, costUsd };
    } catch (error) {
      return toErrorResult(error);
    }
  };
}
