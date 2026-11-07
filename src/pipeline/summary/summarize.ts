import { createHash } from "node:crypto";
import type { AiStatus, Item } from "../types.ts";
import { checkSummary } from "./check.ts";
import type { Summarizer } from "./client.ts";
import type { Overrides } from "./overrides.ts";

/** 同じ本文に使う回数の上限。検証に落ち続ける項目で費用が増えないようにする */
export const MAX_ATTEMPTS = 2;
const CONCURRENCY = 3;

export interface Limits {
  maxCostUsd: number;
  maxItems: number;
}

export const DEFAULT_LIMITS: Limits = { maxCostUsd: 1.5, maxItems: 200 };

/** 要約の保存形式。本文は含めず、変化の検出にハッシュだけを残す */
export interface SummaryRecord {
  hash: string;
  attempts: number;
  text?: string;
  model?: string;
  generatedAt?: string;
  failure?: string;
}

export type SummaryStore = Record<string, SummaryRecord>;

function contentHash(item: Item, body: string): string {
  return createHash("sha256")
    .update(`${item.title}\n${body}\n${item.exploited}`)
    .digest("hex")
    .slice(0, 16);
}

function isPending(
  item: Item,
  store: SummaryStore,
  overrides: Overrides,
): boolean {
  if (item.treatment !== "ai-summary" || overrides[item.id]) return false;
  const record = store[item.id];
  return !record?.text && (record?.attempts ?? 0) < MAX_ATTEMPTS;
}

/** 本文は保存しないので、要約待ちの項目がある情報源は更新がなくても取り直す */
export function sourcesNeedingBody(
  items: Item[],
  store: SummaryStore,
  overrides: Overrides,
): Set<string> {
  return new Set(
    items
      .filter((item) => isPending(item, store, overrides))
      .map((item) => item.source),
  );
}

interface SummarizeOptions {
  items: Item[];
  bodies: ReadonlyMap<string, string>;
  store: SummaryStore;
  overrides: Overrides;
  summarize: Summarizer;
  now: Date;
  limits?: Limits;
}

interface SummarizeResult {
  store: SummaryStore;
  status: AiStatus;
  /** 認証や設定の問題で、運用者の対応が必要 */
  fatalError?: string;
}

/** 失敗しても例外にせず、その項目は定型文のまま公開する */
export async function summarizeItems(
  options: SummarizeOptions,
): Promise<SummarizeResult> {
  const { items, bodies, overrides, summarize, now } = options;
  const limits = options.limits ?? DEFAULT_LIMITS;

  // 期間外の項目を除いて、保存データが増え続けないようにする
  const store: SummaryStore = {};
  for (const item of items) {
    const record = options.store[item.id];
    if (record) store[item.id] = record;
  }

  const hashes = new Map<string, string>();
  for (const item of items) {
    const body = bodies.get(item.id);
    if (item.treatment !== "ai-summary" || body === undefined) continue;
    const hash = contentHash(item, body);
    hashes.set(item.id, hash);
    // 内容が変わった項目の古い要約は、新しい要約ができなくても残さない
    if (store[item.id] && store[item.id].hash !== hash) delete store[item.id];
  }

  const remaining = items
    .filter((item) => hashes.has(item.id) && isPending(item, store, overrides))
    .slice(0, limits.maxItems);

  const status: AiStatus = {
    requested: 0,
    summarized: 0,
    rejected: 0,
    refused: 0,
    errors: 0,
    pending: 0,
    costUsd: 0,
  };
  let fatalError: string | undefined;

  const summarizeOne = async (item: Item): Promise<void> => {
    const hash = hashes.get(item.id) as string;
    const body = bodies.get(item.id) as string;
    const input = { title: item.title, body, exploited: item.exploited };
    const attempts = (store[item.id]?.attempts ?? 0) + 1;

    status.requested += 1;
    const result = await summarize(input);

    if (result.kind === "error") {
      // 通信や混雑の失敗は本文のせいではないので、回数に数えない
      status.errors += 1;
      if (result.stopRun) status.stopped ??= `api-error: ${result.message}`;
      if (result.fatal) fatalError = result.message;
      return;
    }
    status.costUsd += result.costUsd;

    if (result.kind === "refused") {
      // 同じ入力は同じ理由で拒否されるので、再度送らない
      status.refused += 1;
      store[item.id] = { hash, attempts: MAX_ATTEMPTS, failure: result.reason };
      return;
    }
    if (result.kind === "invalid") {
      status.rejected += 1;
      store[item.id] = { hash, attempts, failure: result.reason };
      return;
    }
    const problems = checkSummary(input, result.text);
    if (problems.length > 0) {
      status.rejected += 1;
      store[item.id] = {
        hash,
        attempts,
        failure: `check:${problems.join(",")}`,
      };
      return;
    }
    status.summarized += 1;
    store[item.id] = {
      hash,
      attempts,
      text: result.text,
      model: result.model,
      generatedAt: now.toISOString(),
    };
  };

  const worker = async (): Promise<void> => {
    while (remaining.length > 0 && !status.stopped) {
      if (status.costUsd >= limits.maxCostUsd) {
        status.stopped = "cost-limit";
        return;
      }
      await summarizeOne(remaining.shift() as Item);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  status.pending = items.filter((item) =>
    isPending(item, store, overrides),
  ).length;
  return { store, status, ...(fatalError ? { fatalError } : {}) };
}

/** 保存した要約と手動の差し替えを項目に反映する。手動の指定を優先する */
export function attachSummaries(
  items: Item[],
  store: SummaryStore,
  overrides: Overrides,
): Item[] {
  return items.map((item) => {
    const { summary: _previous, ...rest } = item;
    const override = overrides[item.id];
    if (override) {
      return override.summary === null
        ? rest
        : { ...rest, summary: { text: override.summary, origin: "manual" } };
    }
    const record = store[item.id];
    if (!record?.text) return rest;
    return {
      ...rest,
      summary: {
        text: record.text,
        origin: "ai",
        ...(record.model ? { model: record.model } : {}),
        ...(record.generatedAt ? { generatedAt: record.generatedAt } : {}),
      },
    };
  });
}
