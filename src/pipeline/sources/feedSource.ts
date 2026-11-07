import { type FeedEntry, parseFeed } from "../feed.ts";
import { safeUrl, toIsoDate } from "../text.ts";
import type { Entry, Get, ProductId, Source, Treatment } from "../types.ts";

interface FeedSourceOptions {
  id: string;
  name: string;
  urls: string[];
  treatment: Treatment;
  product?: ProductId;
  /** 対象にする項目を絞る */
  filter?: (entry: FeedEntry) => boolean;
  /** 情報源ごとの項目を足す、または置き換える */
  map?: (entry: FeedEntry) => Partial<Entry>;
}

/** 日付や URL が読めない項目は除外する。公開しない http の URL もここで落とす。 */
export function toEntry(
  source: string,
  feedEntry: FeedEntry,
  treatment: Treatment,
): Entry | null {
  const url = safeUrl(feedEntry.url);
  const publishedAt = toIsoDate(feedEntry.published);
  if (!url || !publishedAt || !feedEntry.title) return null;
  return {
    source,
    key: feedEntry.guid,
    title: feedEntry.title,
    url,
    publishedAt,
    body: feedEntry.body,
    treatment,
  };
}

export function feedSource(options: FeedSourceOptions): Source {
  return {
    id: options.id,
    name: options.name,
    async load(get: Get) {
      const entries: Entry[] = [];
      for (const url of options.urls) {
        const feed = parseFeed(await get(url, { conditional: true }));
        for (const feedEntry of feed) {
          if (options.filter && !options.filter(feedEntry)) continue;
          const entry = toEntry(options.id, feedEntry, options.treatment);
          if (!entry) continue;
          entries.push({
            ...entry,
            ...(options.product ? { product: options.product } : {}),
            ...options.map?.(feedEntry),
          });
        }
      }
      return entries;
    },
  };
}
