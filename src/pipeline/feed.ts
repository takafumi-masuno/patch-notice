import { XMLParser } from "fast-xml-parser";
import { htmlToText } from "./text.ts";

export interface FeedEntry {
  title: string;
  url: string;
  guid: string;
  published: string;
  body: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  // 既定の展開上限に大きなフィードが引っかかるので、実体参照は htmlToText で解決する
  processEntities: false,
  stopNodes: ["*.description", "*.content", "*.content:encoded", "*.summary"],
  isArray: (name) => ["item", "entry", "link"].includes(name),
});

type Node = Record<string, unknown>;

function text(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "#text" in value) {
    return text((value as Node)["#text"]);
  }
  return "";
}

function linkOf(entry: Node): string {
  const links = (entry.link ?? []) as unknown[];
  const atom = links.find(
    (link): link is Node =>
      typeof link === "object" &&
      link !== null &&
      "@_href" in link &&
      ((link as Node)["@_rel"] ?? "alternate") === "alternate",
  );
  return atom ? String(atom["@_href"]) : text(links[0]).trim();
}

function toEntry(entry: Node): FeedEntry {
  const url = linkOf(entry);
  return {
    title: htmlToText(text(entry.title)),
    url,
    guid: text(entry.guid ?? entry.id).trim() || url,
    published: text(
      entry.pubDate ?? entry.published ?? entry.updated ?? entry["dc:date"],
    ).trim(),
    body: htmlToText(
      text(
        entry["content:encoded"] ??
          entry.content ??
          entry.description ??
          entry.summary,
      ),
    ),
  };
}

/** RSS 2.0、Atom、RDF を同じ形にする。項目が読めない形式はエラーにする。 */
export function parseFeed(xml: string): FeedEntry[] {
  const doc = parser.parse(xml) as Node;
  const rss = doc.rss as Node | undefined;
  const channel = rss?.channel as Node | undefined;
  const feed = doc.feed as Node | undefined;
  const rdf = doc["rdf:RDF"] as Node | undefined;
  const entries = (channel?.item ?? feed?.entry ?? rdf?.item) as
    | Node[]
    | undefined;
  if (!entries || entries.length === 0) {
    throw new Error("feed has no entries");
  }
  return entries.map(toEntry);
}
