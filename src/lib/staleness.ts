/** 6時間ごとの定期実行が3回続けて失敗すると超える */
export const STALE_HOURS = 24;

const HOUR_MS = 60 * 60 * 1000;

/** 取得時刻が読めない場合も、新しいものとして扱わない */
export function isStale(fetchedAt: string, now: number): boolean {
  const age = now - Date.parse(fetchedAt);
  return !(age <= STALE_HOURS * HOUR_MS);
}
