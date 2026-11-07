"use client";

import { useSyncExternalStore } from "react";
import { formatDateTime } from "@/lib/format";
import { isStale } from "@/lib/staleness";

const subscribe = () => () => {};

/**
 * 静的サイトは更新が止まると、古い内容のまま公開され続ける。
 * ビルド時には判定できないので、閲覧時の時刻で判定する。
 */
export function StaleNotice({ fetchedAt }: { fetchedAt: string }) {
  const stale = useSyncExternalStore(
    subscribe,
    () => isStale(fetchedAt, Date.now()),
    () => false,
  );
  if (!stale) return null;
  return (
    <p
      className="mb-4 rounded border border-action/40 bg-action-soft p-3 text-sm text-action"
      role="alert"
    >
      データの更新が止まっています（最終更新 {formatDateTime(fetchedAt)}
      ）。最新の情報は公式情報で確認してください。
    </p>
  );
}
