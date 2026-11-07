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
  /** 今回取得できた本文。公開データには保存せず、要約にだけ使う */
  bodies: Map<string, string>;
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
  /** 要約待ちの項目があり、更新がなくても本文を取り直す情報源 */
  needsBody: ReadonlySet<string> = new Set(),
): Promise<PipelineResult> {
  const load = async (source: Source): Promise<Entry[]> => {
    try {
      return await source.load(get, now);
    } catch (error) {
      if (error instanceof NotModifiedError && needsBody.has(source.id)) {
        return source.load(
          (url, options) => get(url, { ...options, conditional: false }),
          now,
        );
      }
      throw error;
    }
  };

  const results = await Promise.all(
    sources.map(async (source) => {
      try {
        const entries = await load(source);
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
  const bodies = new Map<string, string>();
  const statuses: SourceStatus[] = [];
  const merge = (item: Item): boolean => {
    const existing = items.get(item.id);
    if (existing && item.publishedAt < existing.publishedAt) return false;
    items.set(item.id, item);
    return true;
  };
  for (const result of results) {
    const { source, outcome, entries } = result;
    // フィードには直近の項目しかないので、前回の結果と合わせて期間内の履歴を保つ
    for (const item of previous.items) {
      if (item.source === source.id && Date.parse(item.publishedAt) >= cutoff) {
        merge(applyKev(item, kevSet));
      }
    }
    for (const entry of entries) {
      if (Date.parse(entry.publishedAt) < cutoff) continue;
      const item = classify(entry, kevSet);
      if (merge(item)) bodies.set(item.id, entry.body);
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
    bodies,
  };
}
