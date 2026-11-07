import type { Metadata } from "next";
import Link from "next/link";
import { UrgencyBadge } from "@/components/Badges";
import { Preparing } from "@/components/Preparing";
import {
  CERTIFICATE_DEADLINES,
  type CertificateDeadline,
  DEADLINE_STATE_LABELS,
  type DeadlineState,
  deadlineState,
  groupDeadlines,
  SCOPE_LABELS,
} from "@/lib/certificates";
import { referenceTime, type SiteData, siteData } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { byNewest } from "@/lib/listing";

export const metadata: Metadata = { title: "証明書" };

const STATE_STYLES: Record<DeadlineState, string> = {
  next: "bg-action text-white",
  upcoming: "bg-canvas text-muted ring-1 ring-line",
  applied: "bg-canvas text-muted ring-1 ring-line",
  expired: "bg-review-soft text-review ring-1 ring-review/40",
};

function DeadlineCard(props: { entry: CertificateDeadline; now: number }) {
  const { entry, now } = props;
  const state = deadlineState(entry, CERTIFICATE_DEADLINES, now);
  return (
    <li className="rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold">{entry.date.replaceAll("-", "/")}</span>
        <span
          className={`rounded px-2 py-0.5 text-xs font-bold ${STATE_STYLES[state]}`}
        >
          {DEADLINE_STATE_LABELS[state]}
        </span>
        <span className="text-sm text-muted">{SCOPE_LABELS[entry.scope]}</span>
      </div>
      <h3 className="mt-2 font-medium">{entry.title}</h3>
      <p className="mt-1 text-sm">{entry.detail}</p>
      <p className="mt-1 text-sm">対応: {entry.action}</p>
      <p className="mt-2 text-sm text-muted">
        <a
          className="text-accent underline"
          href={entry.sourceUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          {entry.sourceName}（別タブ）
        </a>
        ・確認日 {entry.checkedAt.replaceAll("-", "/")}
      </p>
    </li>
  );
}

function Certificates({ items, status }: SiteData) {
  const now = referenceTime(status);
  const { upcoming, past } = groupDeadlines(CERTIFICATE_DEADLINES, now);
  const incidents = byNewest(
    items.filter((item) => item.product === "ca-incident"),
  );

  return (
    <>
      <h1 className="text-2xl font-bold">証明書</h1>
      <p className="mt-2 text-sm text-muted">
        端末とサーバーの証明書に関する期限です。日付は公式情報を確認して登録しています。
      </p>

      <section aria-labelledby="upcoming" className="mt-6">
        <h2 className="text-lg font-bold" id="upcoming">
          これからの期限
        </h2>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-muted">登録している期限はありません。</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {upcoming.map((entry) => (
              <DeadlineCard entry={entry} key={entry.id} now={now} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="ca-incidents" className="mt-8">
        <h2 className="text-lg font-bold" id="ca-incidents">
          認証局の事案
        </h2>
        <p className="mt-1 text-sm text-muted">
          語句の一致で検知した候補です。緊急度は内容を確認するまで「要確認」として扱います。
        </p>
        {incidents.length === 0 ? (
          <p className="mt-2 text-muted">直近90日の該当はありません。</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {incidents.map((item) => (
              <li
                className="rounded-lg border border-line bg-surface p-3"
                key={item.id}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <UrgencyBadge urgency={item.urgency} />
                  <span className="text-sm text-muted">
                    {formatDate(item.publishedAt)}
                  </span>
                </div>
                <Link
                  className="mt-1 block text-accent underline underline-offset-2"
                  href={`/items/${item.id}/`}
                  prefetch={false}
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="past" className="mt-8">
        <h2 className="text-lg font-bold" id="past">
          経過した期限
        </h2>
        <p className="mt-1 text-sm text-muted">
          期限を過ぎても、更新できていない端末やサーバーが残っている場合があります。
        </p>
        <ul className="mt-3 space-y-3">
          {past.map((entry) => (
            <DeadlineCard entry={entry} key={entry.id} now={now} />
          ))}
        </ul>
      </section>
    </>
  );
}

export default function CertificatesPage() {
  const data = siteData();
  return data ? <Certificates {...data} /> : <Preparing />;
}
