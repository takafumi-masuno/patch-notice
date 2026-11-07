import { applyKev, classify } from "./classify.ts";
import type {
  Entry,
  Get,
  Item,
  Source,
  SourceStatus,
  Status,
} from "./types.ts";

/** 公開データに残す期間 */
const WINDOW_DAYS = 90;

/** 条件付き取得で更新がなかったときに投げる */
export class NotModifiedError extends Error {}

interface Previous {
  items: Item[];
  kevCves: string[];
}

interface PipelineResult {
  items: Item[];
  status: Status;
  kevCves: string[];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** 1つの情報源が失敗しても、他の情報源は処理を続ける */
export async function runPipeline(
  sources: Source[],
  get: Get,
  now: Date,
  previous: Previous,
): Promise<PipelineResult> {
  const results = await Promise.all(
    sources.map(async (source) => {
      try {
        const entries = await source.load(get);
        return { source, entries, outcome: "ok" as const };
      } catch (error) {
        if (error instanceof NotModifiedError) {
          return { source, entries: [], outcome: "notModified" as const };
        }
        return {
          source,
          entries: [],
          outcome: "failed" as const,
          error: errorMessage(error),
        };
      }
    }),
  );

  const kevResult = results.find((result) => result.source.id === "kev");
  const kevCves =
    kevResult?.outcome === "ok"
      ? kevResult.entries.map((entry: Entry) => entry.key)
      : previous.kevCves;
  const kevSet = new Set(kevCves);
  const cutoff = now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000;

  const items = new Map<string, Item>();
  const statuses: SourceStatus[] = [];
  for (const result of results) {
    const { source, outcome, entries } = result;
    // フィードには直近の項目しかないので、前回の結果と合わせて期間内の履歴を保つ
    const kept = previous.items
      .filter(
        (item) =>
          item.source === source.id && Date.parse(item.publishedAt) >= cutoff,
      )
      .map((item) => applyKev(item, kevSet));
    const fresh = entries
      .filter((entry) => Date.parse(entry.publishedAt) >= cutoff)
      .map((entry) => classify(entry, kevSet));
    for (const item of [...kept, ...fresh]) {
      const existing = items.get(item.id);
      if (!existing || item.publishedAt >= existing.publishedAt) {
        items.set(item.id, item);
      }
    }
    statuses.push({
      id: source.id,
      name: source.name,
      ok: outcome !== "failed",
      notModified: outcome === "notModified",
      entries: entries.length,
      items: [...items.values()].filter((item) => item.source === source.id)
        .length,
      ...(result.outcome === "failed" ? { error: result.error } : {}),
    });
  }

  return {
    items: [...items.values()].sort((a, b) =>
      b.publishedAt.localeCompare(a.publishedAt),
    ),
    status: { fetchedAt: now.toISOString(), sources: statuses },
    kevCves,
  };
}
