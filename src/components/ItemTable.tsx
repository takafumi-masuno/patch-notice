"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import {
  AUDIENCE_LABELS,
  DEFAULT_FILTERS,
  type Filters,
  filterRows,
  filtersToSearch,
  type ListRow,
  PERIOD_LABELS,
  type Period,
  parseFilters,
} from "@/lib/listing";
import { productLabel, URGENCY_LABELS } from "@/lib/notice";
import type { Audience, ProductId, Urgency } from "@/pipeline/types";
import { ExploitationText, UrgencyBadge } from "./Badges";

const URL_CHANGED = "patch-notice:url-changed";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  window.addEventListener(URL_CHANGED, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(URL_CHANGED, onChange);
  };
}

const currentSearch = () => window.location.search;
const serverSearch = () => "";

const SELECT_CLASS =
  "mt-1 block w-full rounded border border-line bg-surface px-2 py-1.5 text-sm";

function FilterSelect<T extends string>(props: {
  label: string;
  name: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="block text-sm font-medium">
      {props.label}
      <select
        className={SELECT_CLASS}
        name={props.name}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value as T)}
      >
        {props.options.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ItemRow({ row }: { row: ListRow }) {
  return (
    <tr className="border-t border-line align-top">
      <td className="px-3 py-2">
        <UrgencyBadge urgency={row.urgency} />
      </td>
      <td className="hidden px-3 py-2 text-sm whitespace-nowrap md:table-cell">
        {row.date}
      </td>
      <td className="hidden px-3 py-2 text-sm md:table-cell">
        {productLabel(row.product)}
      </td>
      <td className="px-3 py-2">
        <Link
          className="text-accent underline underline-offset-2"
          href={`/items/${row.id}/`}
          prefetch={false}
        >
          {row.title}
        </Link>
        {/* 幅が狭いと列を隠すので、同じ内容をタイトルの下に出す */}
        <p className="mt-1 text-xs text-muted md:hidden">
          {row.date}・{productLabel(row.product)}
        </p>
        <p className="md:hidden">
          <ExploitationText status={row.exploitation} />
        </p>
      </td>
      <td className="hidden px-3 py-2 md:table-cell">
        <ExploitationText status={row.exploitation} />
      </td>
      <td className="hidden px-3 py-2 text-right text-sm md:table-cell">
        {row.cveCount}
      </td>
    </tr>
  );
}

/**
 * 絞り込みの条件は URL を正とする。初回の HTML には全件が入り、
 * JavaScript が動かない環境でも一覧を読める。
 */
export function ItemTable(props: {
  rows: ListRow[];
  products: ProductId[];
  /** 期間の基準になるデータの取得時刻 */
  now: number;
}) {
  const search = useSyncExternalStore(subscribe, currentSearch, serverSearch);
  const filters = parseFilters(search, props.products);
  const rows = filterRows(props.rows, filters, props.now);

  const update = (next: Filters) => {
    const url = `${window.location.pathname}${filtersToSearch(next)}`;
    window.history.replaceState(null, "", url);
    window.dispatchEvent(new Event(URL_CHANGED));
  };
  const change = (patch: Partial<Filters>) => update({ ...filters, ...patch });

  const urgencyOptions: (readonly [Filters["urgency"], string])[] = [
    ["all", "すべて"],
    ...(Object.entries(URGENCY_LABELS) as [Urgency, string][]),
  ];
  const productOptions: (readonly [Filters["product"], string])[] = [
    ["all", "すべて"],
    ...props.products.map(
      (product) => [product, productLabel(product)] as const,
    ),
  ];
  const audienceOptions: (readonly [Filters["audience"], string])[] = [
    ["all", "すべて"],
    ...(Object.entries(AUDIENCE_LABELS) as [Audience, string][]),
  ];
  const periodOptions = Object.entries(PERIOD_LABELS).reverse() as [
    Period,
    string,
  ][];

  return (
    <>
      <form
        className="grid grid-cols-2 gap-3 rounded-t-lg border border-line bg-surface p-3 md:grid-cols-5"
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="col-span-2 block text-sm font-medium md:col-span-1">
          語句、CVE 番号
          <input
            className={SELECT_CLASS}
            type="search"
            name="q"
            value={filters.query}
            onChange={(event) => change({ query: event.target.value })}
          />
        </label>
        <FilterSelect
          label="緊急度"
          name="urgency"
          value={filters.urgency}
          options={urgencyOptions}
          onChange={(urgency) => change({ urgency })}
        />
        <FilterSelect
          label="製品"
          name="product"
          value={filters.product}
          options={productOptions}
          onChange={(product) => change({ product })}
        />
        <FilterSelect
          label="読者"
          name="audience"
          value={filters.audience}
          options={audienceOptions}
          onChange={(audience) => change({ audience })}
        />
        <FilterSelect
          label="期間"
          name="period"
          value={filters.period}
          options={periodOptions}
          onChange={(period) => change({ period })}
        />
      </form>

      <div className="flex items-center justify-between border-x border-line bg-surface px-3 py-2 text-sm">
        <p aria-live="polite" data-testid="result-count">
          {rows.length} 件
        </p>
        {filtersToSearch(filters) !== "" && (
          <button
            className="text-accent underline underline-offset-2"
            type="button"
            onClick={() => update(DEFAULT_FILTERS)}
          >
            条件を解除
          </button>
        )}
      </div>

      <div className="rounded-b-lg border border-line bg-surface">
        {rows.length === 0 ? (
          <p className="p-6 text-center text-muted">
            条件に合う情報はありません。
          </p>
        ) : (
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">脆弱性とアップデートの情報</caption>
            <thead className="text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium" scope="col">
                  緊急度
                </th>
                <th
                  className="hidden px-3 py-2 font-medium md:table-cell"
                  scope="col"
                >
                  公開日
                </th>
                <th
                  className="hidden px-3 py-2 font-medium md:table-cell"
                  scope="col"
                >
                  製品
                </th>
                <th className="px-3 py-2 font-medium" scope="col">
                  内容
                </th>
                <th
                  className="hidden px-3 py-2 font-medium whitespace-nowrap md:table-cell"
                  scope="col"
                >
                  悪用の状況
                </th>
                <th
                  className="hidden px-3 py-2 text-right font-medium md:table-cell"
                  scope="col"
                >
                  CVE
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <ItemRow key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
