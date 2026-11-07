import { describe, expect, it } from "vitest";
import { absoluteUrl, isHttpsUrl } from "./site.ts";

describe("isHttpsUrl", () => {
  it("https だけを通す", () => {
    expect(isHttpsUrl("https://example.com/")).toBe(true);
    expect(isHttpsUrl("http://example.com/")).toBe(false);
    expect(isHttpsUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpsUrl("/relative")).toBe(false);
    expect(isHttpsUrl("")).toBe(false);
  });
});

describe("absoluteUrl", () => {
  it("公開 URL を組み立てる", () => {
    expect(absoluteUrl("/")).toBe(
      "https://takafumi-masuno.github.io/patch-notice/",
    );
    expect(absoluteUrl("/feed.xml")).toBe(
      "https://takafumi-masuno.github.io/patch-notice/feed.xml",
    );
  });

  it("/ から始まらないパスはエラーにする", () => {
    expect(() => absoluteUrl("feed.xml")).toThrow();
  });
});
