import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ExploitationText, UrgencyBadge } from "@/components/Badges";
import { CopyButton } from "@/components/CopyButton";
import { Preparing } from "@/components/Preparing";
import { siteData, sourceName } from "@/lib/data";
import { formatDate } from "@/lib/format";
import {
  AI_SUMMARY_LABEL,
  EXPLOITATION_DETAILS,
  employeeCopyText,
  exploitationStatus,
  itCopyText,
  type Notice,
  noticeFor,
  productLabel,
} from "@/lib/notice";
import { isHttpsUrl } from "@/lib/site";
import type { Item } from "@/pipeline/types";

/** 静的書き出しでは空の一覧を返せないので、データがない間はこの1ページだけ作る */
const PREPARING_ID = "preparing";
const VISIBLE_CVES = 20;

export const dynamicParams = false;

export function generateStaticParams() {
  const items = siteData()?.items ?? [];
  return items.length > 0
    ? items.map((item) => ({ id: item.id }))
    : [{ id: PREPARING_ID }];
}

interface Props {
  params: Promise<{ id: string }>;
}

function findItem(id: string): Item | undefined {
  return siteData()?.items.find((item) => item.id === id);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const item = findItem(id);
  return item ? { title: item.title } : {};
}

function Section(props: { id: string; title: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby={props.id}
      className="rounded-lg border border-line bg-surface p-4"
    >
      <h2 className="font-bold" id={props.id}>
        {props.title}
      </h2>
      <div className="mt-2 space-y-3">{props.children}</div>
    </section>
  );
}

function summaryOriginNote(notice: Notice): string {
  if (notice.summaryOrigin === "ai") {
    const model = notice.summaryModel ? `（${notice.summaryModel}）` : "";
    return `${AI_SUMMARY_LABEL}${model}です。誤りを含む可能性があるので、対応の判断は公式情報で確認してください。`;
  }
  if (notice.summaryOrigin === "manual") return "手動で作成した要約です。";
  return "公開データの事実をもとに、定型文で作成しています。AI は使っていません。";
}

function CveList({ item }: { item: Item }) {
  if (item.cves.length === 0) {
    return item.cveCount > 0 ? (
      <p>{item.cveCount} 件（個別の番号は公式情報を確認してください）</p>
    ) : (
      <p className="text-muted">公開データに CVE 番号はありません。</p>
    );
  }
  const visible = item.cves.slice(0, VISIBLE_CVES);
  const rest = item.cves.slice(VISIBLE_CVES);
  const list = (cves: string[]) => (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-sm">
      {cves.map((cve) => (
        <li key={cve}>{cve}</li>
      ))}
    </ul>
  );
  return (
    <>
      {list(visible)}
      {rest.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-accent">
            残り {rest.length} 件を表示
          </summary>
          <div className="mt-2">{list(rest)}</div>
        </details>
      )}
    </>
  );
}

function Detail({ item, source }: { item: Item; source: string }) {
  const notice = noticeFor(item);
  const status = exploitationStatus(item);
  return (
    <article className="space-y-4">
      <p className="text-sm">
        <Link className="text-accent underline" href="/" prefetch={false}>
          一覧へ戻る
        </Link>
      </p>
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <UrgencyBadge urgency={item.urgency} />
          <span className="text-sm text-muted">
            {formatDate(item.publishedAt)}・{productLabel(item.product)}
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-bold">{item.title}</h1>
      </header>

      <Section id="exploitation" title="悪用の状況">
        <p>
          <ExploitationText status={status} />
        </p>
        <p className="text-sm">{EXPLOITATION_DETAILS[status]}</p>
        {item.urgencyReasons.length > 0 && (
          <p className="text-sm text-muted">
            緊急度の根拠: {item.urgencyReasons.join("、")}
          </p>
        )}
      </Section>

      <Section id="summary" title="概要">
        <p>{notice.summary}</p>
        <p className="text-sm text-muted">{summaryOriginNote(notice)}</p>
      </Section>

      <Section id="it-action" title="情シスの対応">
        <p className="whitespace-pre-line">{notice.itAction}</p>
        <CopyButton
          label="情シス向けの文をコピー"
          text={itCopyText(item, notice)}
        />
      </Section>

      {notice.employee && (
        <Section id="employee" title="社員向けの周知文">
          <p className="font-medium">件名: {notice.employee.subject}</p>
          <p className="whitespace-pre-line">{notice.employee.body}</p>
          <CopyButton
            label="社員向けの文をコピー"
            text={employeeCopyText(notice.employee)}
          />
        </Section>
      )}

      <Section id="cves" title="CVE">
        <CveList item={item} />
      </Section>

      <Section id="official" title="出典と公式情報">
        <p>出典: {source}</p>
        {item.version && <p>バージョン: {item.version}</p>}
        {item.vendorSeverity && <p>メーカーの評価: {item.vendorSeverity}</p>}
        {isHttpsUrl(item.url) ? (
          <p>
            <a
              className="text-accent underline"
              href={item.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              公式情報を開く（別タブ）
            </a>
          </p>
        ) : (
          <p className="text-muted">公式情報のリンクは表示できません。</p>
        )}
      </Section>
    </article>
  );
}

export default async function ItemPage({ params }: Props) {
  const { id } = await params;
  const data = siteData();
  if (!data) return <Preparing />;
  const item = findItem(id);
  if (!item) notFound();
  return <Detail item={item} source={sourceName(data.status, item.source)} />;
}
