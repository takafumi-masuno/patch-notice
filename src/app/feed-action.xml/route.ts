import { siteData } from "@/lib/data";
import { rssResponse } from "@/lib/rss";

export const dynamic = "force-static";

export function GET() {
  const data = siteData();
  return rssResponse({
    title: "要対応",
    description: "脆弱性とアップデートの情報のうち、要対応の項目です。",
    path: "/feed-action.xml",
    items: data?.items.filter((item) => item.urgency === "action") ?? [],
    updatedAt: data?.status.fetchedAt ?? new Date().toISOString(),
  });
}
