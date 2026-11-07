import { NotModifiedError } from "./run.ts";
import type { Get } from "./types.ts";

const USER_AGENT =
  "patch-notice (+https://github.com/takafumi-masuno/patch-notice)";
const TIMEOUT_MS = 60_000;

export interface CacheEntry {
  etag?: string;
  lastModified?: string;
}

export type HttpCache = Record<string, CacheEntry>;

/** `cache` を書き換えて、次回の条件付き取得に使う値を残す */
export function createFetcher(
  cache: HttpCache,
  fetchFn: typeof fetch = fetch,
): Get {
  return async (url, options) => {
    const conditional = options?.conditional === true;
    const cached = conditional ? cache[url] : undefined;
    const response = await fetchFn(url, {
      headers: {
        "User-Agent": USER_AGENT,
        ...(cached?.etag ? { "If-None-Match": cached.etag } : {}),
        ...(cached?.lastModified
          ? { "If-Modified-Since": cached.lastModified }
          : {}),
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status === 304) {
      throw new NotModifiedError(url);
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${url}`);
    }
    if (conditional) {
      const etag = response.headers.get("etag");
      const lastModified = response.headers.get("last-modified");
      cache[url] = {
        ...(etag ? { etag } : {}),
        ...(lastModified ? { lastModified } : {}),
      };
    }
    return response.text();
  };
}
