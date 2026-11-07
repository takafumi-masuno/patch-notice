import { describe, expect, it, vi } from "vitest";
import { classify } from "../classify.ts";
import { patchTuesday, windowsMonthly } from "./windowsMonthly.ts";

describe("patchTuesday", () => {
  it.each([
    // 1日が火曜、水曜、月曜の月
    [2026, 8, "2026-09-08"],
    [2026, 3, "2026-04-14"],
    [2026, 5, "2026-06-09"],
    [2026, 10, "2026-11-10"],
    [2026, 11, "2026-12-08"],
  ])("%i年の月番号 %i は %s", (year, month, expected) => {
    expect(patchTuesday(year, month).toISOString().slice(0, 10)).toBe(expected);
  });

  it("夏時間でも冬時間でも、太平洋時間の午前10時を過ぎている", () => {
    expect(patchTuesday(2026, 6).getUTCHours()).toBe(18);
    expect(patchTuesday(2026, 10).getUTCHours()).toBe(18);
  });
});

describe("windowsMonthly", () => {
  it("取得は行わず、過ぎた更新日だけを新しい順に出す", async () => {
    const get = vi.fn();
    const entries = await windowsMonthly.load(
      get,
      new Date("2026-11-10T17:59:59Z"),
    );
    expect(get).not.toHaveBeenCalled();
    expect(entries.map((entry) => entry.key)).toEqual(["2026-Oct", "2026-Sep"]);
  });

  it("当日の 18:00 UTC から当月の項目を出す", async () => {
    const [entry] = await windowsMonthly.load(
      vi.fn(),
      new Date("2026-11-10T18:00:00Z"),
    );
    expect(entry.title).toBe("Windows / Office の月例更新日（2026年11月）");
    expect(entry.url).toBe(
      "https://msrc.microsoft.com/update-guide/releaseNote/2026-Nov",
    );
  });

  it("年をまたいでも前の月を求められる", async () => {
    const entries = await windowsMonthly.load(
      vi.fn(),
      new Date("2027-01-05T00:00:00Z"),
    );
    expect(entries.map((entry) => entry.key)).toEqual(["2026-Dec", "2026-Nov"]);
  });

  it("要確認にして社員向けの周知文を出す。悪用の判定はしない", async () => {
    const [entry] = await windowsMonthly.load(
      vi.fn(),
      new Date("2026-11-11T00:00:00Z"),
    );
    const item = classify(entry, new Set());
    expect(item.urgency).toBe("review");
    expect(item.urgencyReasons).toEqual(["毎月の定例の更新日"]);
    expect(item.exploited).toBe(false);
    expect(item.audience).toBe("both");
    expect(item.cveCount).toBe(0);
  });
});
