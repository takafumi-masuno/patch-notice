import { XMLParser, XMLValidator } from "fast-xml-parser";
import { describe, expect, it } from "vitest";
import type { Item } from "../pipeline/types.ts";
import { buildRss, escapeXml, RSS_LIMIT } from "./rss.ts";

const item = (overrides: Partial<Item> = {}): Item => ({
  id: "abc",
  source: "kev",
  product: "chrome",
  title: "Title",
  url: "https://example.com/",
  publishedAt: "2026-11-06T00:00:00.000Z",
  cves: [],
  cveCount: 0,
  exploited: false,
  urgency: "action",
  urgencyReasons: [],
  audience: "both",
  treatment: "facts",
  ...overrides,
});

const rss = (items: Item[]) =>
  buildRss({
    title: "全件",
    description: "説明 & 詳細",
    path: "/feed.xml",
    items,
    updatedAt: "2026-11-07T00:00:00.000Z",
  });

describe("escapeXml", () => {
  it("XML の特殊文字を置き換える", () => {
    expect(escapeXml(`<a href="x">&'`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&apos;",
    );
  });

  it("XML で使えない制御文字を消し、改行とタブは残す", () => {
    expect(escapeXml("a\u0000b\u0008c\u000Bd￾e\n\tf")).toBe("abcde\n\tf");
  });

  it("絵文字のような補助面の文字は残す", () => {
    expect(escapeXml("🔒")).toBe("🔒");
  });
});

describe("buildRss", () => {
  it("正しい XML を出す", () => {
    const xml = rss([
      item({
        title: `<script>alert("x")</script> & ]]>`,
        summary: { text: "要約 <b>太字</b>\u0000", origin: "ai" },
      }),
    ]);
    expect(XMLValidator.validate(xml)).toBe(true);
    expect(xml).not.toContain("<script>");
    expect(xml).not.toContain("<b>");
  });

  it("リンクはサイトの詳細ページへ向ける", () => {
    const xml = rss([item()]);
    const link = "https://takafumi-masuno.github.io/patch-notice/items/abc/";
    expect(xml).toContain(`<link>${link}</link>`);
    expect(xml).toContain(`<guid isPermaLink="true">${link}</guid>`);
  });

  it("AI の要約には分かる表示を付け、定型文には付けない", () => {
    expect(rss([item({ summary: { text: "要約", origin: "ai" } })])).toContain(
      "<description>AI 要約: 要約</description>",
    );
    expect(rss([item()])).not.toContain("AI 要約");
    expect(
      rss([item({ summary: { text: "手動の文", origin: "manual" } })]),
    ).not.toContain("AI 要約");
  });

  it("新しい順に上限の件数まで出す", () => {
    const items = Array.from({ length: RSS_LIMIT + 5 }, (_, index) =>
      item({
        id: String(index),
        publishedAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
      }),
    );
    const parsed = new XMLParser({ ignoreAttributes: false }).parse(rss(items));
    const entries = parsed.rss.channel.item;
    expect(entries).toHaveLength(RSS_LIMIT);
    expect(entries[0].link).toContain(`/items/${RSS_LIMIT + 4}/`);
  });

  it("項目がなくても正しい XML を出す", () => {
    expect(XMLValidator.validate(rss([]))).toBe(true);
  });
});
