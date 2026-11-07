import { describe, expect, it } from "vitest";
import { parseFeed } from "./feed.ts";

describe("parseFeed", () => {
  it("RSS 2.0 を読める", () => {
    const [entry] = parseFeed(`<?xml version="1.0"?><rss version="2.0"><channel>
      <item><title>Title &amp; more</title><link>https://example.com/1</link>
      <guid>guid-1</guid><pubDate>Tue, 20 Oct 2026 12:00:00 +0000</pubDate>
      <description>&lt;p&gt;Body&lt;/p&gt;</description></item>
      </channel></rss>`);
    expect(entry).toEqual({
      title: "Title & more",
      url: "https://example.com/1",
      guid: "guid-1",
      published: "Tue, 20 Oct 2026 12:00:00 +0000",
      body: "Body",
    });
  });

  it("Atom の alternate リンクと入れ子の本文を読める", () => {
    const [entry] = parseFeed(`<feed xmlns="http://www.w3.org/2005/Atom">
      <entry><title type="text">Atom</title><id>tag:1</id>
      <link rel="replies" href="https://example.com/comments"/>
      <link rel="alternate" href="https://example.com/post"/>
      <published>2026-10-20T00:00:00Z</published>
      <content type="xhtml"><div><p>Nested</p></div></content></entry></feed>`);
    expect(entry.title).toBe("Atom");
    expect(entry.url).toBe("https://example.com/post");
    expect(entry.guid).toBe("tag:1");
    expect(entry.body).toBe("Nested");
  });

  it("RDF を読める", () => {
    const [entry] = parseFeed(`<rdf:RDF><item>
      <title>注意喚起: テスト</title><link>https://example.jp/a</link>
      <dc:date>2026-11-05T09:52+09:00</dc:date></item></rdf:RDF>`);
    expect(entry.title).toBe("注意喚起: テスト");
    expect(entry.guid).toBe("https://example.jp/a");
    expect(entry.published).toBe("2026-11-05T09:52+09:00");
  });

  it("項目が1件でも配列として扱う", () => {
    const entries = parseFeed(
      `<rss><channel><item><title>A</title></item></channel></rss>`,
    );
    expect(entries).toHaveLength(1);
  });

  it("項目がないフィードはエラーにする", () => {
    expect(() => parseFeed("<rss><channel></channel></rss>")).toThrow();
    expect(() => parseFeed("<html><body>maintenance</body></html>")).toThrow();
    expect(() => parseFeed("")).toThrow();
  });
});
