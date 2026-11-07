import Link from "next/link";
import { ExploitationText, UrgencyBadge } from "@/components/Badges";
import { ItemTable } from "@/components/ItemTable";
import { Preparing } from "@/components/Preparing";
import { CERTIFICATE_DEADLINES, nextDeadline } from "@/lib/certificates";
import { referenceTime, type SiteData, siteData } from "@/lib/data";
import { formatDate, formatDateTime } from "@/lib/format";
import { byNewest, priorityItems, RECENT_DAYS, toRow } from "@/lib/listing";
import {
  AI_SUMMARY_LABEL,
  exploitationStatus,
  noticeFor,
  PRODUCT_NAMES,
  productLabel,
} from "@/lib/notice";
import type { Item, ProductId } from "@/pipeline/types";

function Tile(props: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <dt className="text-sm text-muted">{props.label}</dt>
      <dd className="mt-1 text-2xl font-bold">{props.value}</dd>
      {props.note && <dd className="mt-1 text-xs text-muted">{props.note}</dd>}
    </div>
  );
}

function PriorityCard({ item }: { item: Item }) {
  const notice = noticeFor(item);
  return (
    <li className="rounded-lg border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <UrgencyBadge urgency={item.urgency} />
        <span className="text-sm text-muted">
          {formatDate(item.publishedAt)}・{productLabel(item.product)}
        </span>
        <ExploitationText status={exploitationStatus(item)} />
      </div>
      <h3 className="mt-1 font-medium">
        <Link
          className="text-accent underline underline-offset-2"
          href={`/items/${item.id}/`}
          prefetch={false}
        >
          {item.title}
        </Link>
      </h3>
      <p className="mt-1 line-clamp-2 text-sm text-muted">
        {notice.summaryOrigin === "ai" && (
          <span className="font-bold">{AI_SUMMARY_LABEL}: </span>
        )}
        {notice.summary}
      </p>
    </li>
  );
}

function Dashboard({ items, status }: SiteData) {
  const now = referenceTime(status);
  const priority = priorityItems(items, now);
  const count = (urgency: string) =>
    priority.filter((item) => item.urgency === urgency).length;
  const exploited = priority.filter((item) => item.exploited).length;
  const certificate = nextDeadline(CERTIFICATE_DEADLINES, now);
  const failed = status.sources.filter((source) => !source.ok);
  const present = new Set(items.map((item) => item.product));
  const products = (Object.keys(PRODUCT_NAMES) as ProductId[]).filter(
    (product) => present.has(product),
  );

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">脆弱性とアップデートの情報</h1>
        <p className="text-sm text-muted">
          最終更新 {formatDateTime(status.fetchedAt)}
        </p>
      </div>

      {failed.length > 0 && (
        <output className="mt-3 block rounded border border-review/40 bg-review-soft p-3 text-sm text-review">
          取得に失敗した情報源があります:{" "}
          {failed.map((source) => source.name).join("、")}
        </output>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile
          label={`要対応（直近${RECENT_DAYS}日）`}
          value={`${count("action")} 件`}
        />
        <Tile
          label={`要確認（直近${RECENT_DAYS}日）`}
          value={`${count("review")} 件`}
        />
        <Tile
          label={`悪用確認（直近${RECENT_DAYS}日）`}
          value={`${exploited} 件`}
          note="関連する CVE の悪用を含みます"
        />
        <Tile
          label="次の証明書の期限"
          value={certificate ? formatDate(certificate.date) : "なし"}
          note={certificate?.title}
        />
      </dl>

      <section aria-labelledby="priority" className="mt-8">
        <h2 className="text-lg font-bold" id="priority">
          直近{RECENT_DAYS}日の要対応と要確認
        </h2>
        {priority.length === 0 ? (
          <p className="mt-2 text-muted">該当する情報はありません。</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {priority.map((item) => (
              <PriorityCard item={item} key={item.id} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="all-items" className="mt-8">
        <h2 className="mb-3 text-lg font-bold" id="all-items">
          すべての情報
        </h2>
        <ItemTable
          now={now}
          products={products}
          rows={byNewest(items).map(toRow)}
        />
      </section>
    </>
  );
}

export default function Home() {
  const data = siteData();
  return data ? <Dashboard {...data} /> : <Preparing />;
}
