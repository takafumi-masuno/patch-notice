import { WINDOWS_MONTHLY_SOURCE } from "../reasons.ts";
import type { Entry, Source } from "../types.ts";

const RELEASE_URL = "https://msrc.microsoft.com/update-guide/releaseNote/";
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
/** 公開データに残す90日分を、初回から出せるようにする */
const MONTHS = 3;
const TUESDAY = 2;

/**
 * 第2火曜の 18:00 UTC を返す。`month` は 0 始まり。
 * 太平洋時間の午前10時の公開を、夏時間でも冬時間でも過ぎた時刻にする。
 */
export function patchTuesday(year: number, month: number): Date {
  const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const firstTuesday = 1 + ((TUESDAY - firstDay + 7) % 7);
  return new Date(Date.UTC(year, month, firstTuesday + 7, 18));
}

function toEntry(date: Date): Entry {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const id = `${year}-${MONTH_NAMES[month]}`;
  return {
    source: WINDOWS_MONTHLY_SOURCE,
    key: id,
    title: `Windows / Office の月例更新日（${year}年${month + 1}月）`,
    url: `${RELEASE_URL}${id}`,
    publishedAt: date.toISOString(),
    body: "",
    treatment: "facts",
    product: "windows-office",
    cveCount: 0,
    monthlyUpdate: true,
  };
}

/** Microsoft から何も取得しない。日付を計算し、公式情報へのリンクだけを出す */
export const windowsMonthly: Source = {
  id: WINDOWS_MONTHLY_SOURCE,
  name: "Windows 月例更新日（日付の計算）",
  async load(_get, now) {
    const dates: Date[] = [];
    for (let back = 0; back < MONTHS; back += 1) {
      const month = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1),
      );
      dates.push(patchTuesday(month.getUTCFullYear(), month.getUTCMonth()));
    }
    return dates.filter((date) => date <= now).map(toEntry);
  },
};
