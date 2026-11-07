import { siteData, sourceName } from "@/lib/data";
import { rssResponse } from "@/lib/rss";

export const dynamic = "force-static";

export function GET() {
  const data = siteData();
  return rssResponse({
    title: "全件",
    description: "脆弱性とアップデートの情報です。",
    path: "/feed.xml",
    items: data?.items ?? [],
    updatedAt: data?.status.fetchedAt ?? new Date().toISOString(),
    sourceLabel: (id) => (data ? sourceName(data.status, id) : id),
  });
}
