import { describe, expect, it } from "vitest";
import { absoluteUrl } from "./site";

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
