import type { Item } from "../pipeline/types.ts";
import { byNewest } from "./listing.ts";
import { AI_SUMMARY_LABEL, noticeFor, URGENCY_LABELS } from "./notice.ts";
import { absoluteUrl, SITE_NAME } from "./site.ts";

export const RSS_LIMIT = 50;

/** XML 1.0 で使えない文字。1文字でも残ると配信全体が読めなくなる */
function isValidXmlChar(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  if (code === 0x9 || code === 0xa || code === 0xd) return true;
  return code >= 0x20 && code !== 0xfffe && code !== 0xffff;
}

export function escapeXml(text: string): string {
  return [...text]
    .filter(isValidXmlChar)
    .join("")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function rssItem(item: Item): string {
  const notice = noticeFor(item);
  const link = escapeXml(absoluteUrl(`/items/${item.id}/`));
  const label = notice.summaryOrigin === "ai" ? `${AI_SUMMARY_LABEL}: ` : "";
  return [
    "<item>",
    `<title>${escapeXml(`[${URGENCY_LABELS[item.urgency]}] ${item.title}`)}</title>`,
    `<link>${link}</link>`,
    `<guid isPermaLink="true">${link}</guid>`,
    `<pubDate>${new Date(item.publishedAt).toUTCString()}</pubDate>`,
    `<description>${escapeXml(`${label}${notice.summary}`)}</description>`,
    "</item>",
  ].join("");
}

export interface RssOptions {
  title: string;
  description: string;
  /** サイト内のパス。例: /feed.xml */
  path: string;
  items: Item[];
  updatedAt: string;
}

export function rssResponse(options: RssOptions): Response {
  return new Response(buildRss(options), {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}

export function buildRss(options: RssOptions): string {
  const items = byNewest(options.items).slice(0, RSS_LIMIT);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "<channel>",
    `<title>${escapeXml(`${SITE_NAME} ${options.title}`)}</title>`,
    `<link>${escapeXml(absoluteUrl("/"))}</link>`,
    `<description>${escapeXml(options.description)}</description>`,
    "<language>ja</language>",
    `<lastBuildDate>${new Date(options.updatedAt).toUTCString()}</lastBuildDate>`,
    `<atom:link href="${escapeXml(absoluteUrl(options.path))}" rel="self" type="application/rss+xml"/>`,
    ...items.map(rssItem),
    "</channel>",
    "</rss>",
    "",
  ].join("\n");
}
