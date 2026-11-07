import { describe, expect, it, vi } from "vitest";
import { createFetcher, type HttpCache } from "./fetcher.ts";
import { NotModifiedError } from "./run.ts";

const URL = "https://example.com/feed";

function headersOf(fetchFn: ReturnType<typeof vi.fn>) {
  const init = fetchFn.mock.calls[0][1] as RequestInit;
  return init.headers as Record<string, string>;
}

describe("createFetcher", () => {
  it("リポジトリの URL を含む User-Agent を送り、メールアドレスは含めない", async () => {
    const fetchFn = vi.fn(async () => new Response("ok"));
    await createFetcher({}, fetchFn)(URL);
    const userAgent = headersOf(fetchFn)["User-Agent"];
    expect(userAgent).toContain(
      "https://github.com/takafumi-masuno/patch-notice",
    );
    expect(userAgent).not.toContain("@");
  });

  it("ETag を保存して次回の条件に使う", async () => {
    const cache: HttpCache = {};
    const first = vi.fn(
      async () => new Response("body", { headers: { ETag: '"v1"' } }),
    );
    await createFetcher(cache, first)(URL, { conditional: true });
    expect(cache[URL]).toEqual({ etag: '"v1"' });

    const second = vi.fn(async () => new Response("body"));
    await createFetcher(cache, second)(URL, { conditional: true });
    expect(headersOf(second)["If-None-Match"]).toBe('"v1"');
  });

  it("304 は NotModifiedError にする", async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 304 }));
    await expect(
      createFetcher({}, fetchFn)(URL, { conditional: true }),
    ).rejects.toBeInstanceOf(NotModifiedError);
  });

  it("条件付きでない取得はキャッシュを使わない", async () => {
    const cache: HttpCache = { [URL]: { etag: '"v1"' } };
    const fetchFn = vi.fn(async () => new Response("body"));
    await createFetcher(cache, fetchFn)(URL);
    expect(headersOf(fetchFn)).not.toHaveProperty("If-None-Match");
  });

  it("エラーの応答は例外にする", async () => {
    const fetchFn = vi.fn(async () => new Response("no", { status: 503 }));
    await expect(createFetcher({}, fetchFn)(URL)).rejects.toThrow("503");
  });

  it("Accept を指定できる", async () => {
    const fetchFn = vi.fn(async () => new Response("{}"));
    await createFetcher({}, fetchFn)(URL, { accept: "application/json" });
    expect(headersOf(fetchFn).Accept).toBe("application/json");
  });
});
