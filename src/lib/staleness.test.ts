import { describe, expect, it } from "vitest";
import { isStale, STALE_HOURS } from "./staleness.ts";

const FETCHED = "2026-11-07T03:00:00.000Z";
const at = (hours: number) => Date.parse(FETCHED) + hours * 60 * 60 * 1000;

describe("isStale", () => {
  it("基準の時間までは新しいものとして扱う", () => {
    expect(isStale(FETCHED, at(0))).toBe(false);
    expect(isStale(FETCHED, at(STALE_HOURS))).toBe(false);
  });

  it("基準の時間を過ぎたら古いものとして扱う", () => {
    expect(isStale(FETCHED, at(STALE_HOURS + 0.01))).toBe(true);
  });

  it("閲覧者の時計が取得時刻より前でも、古いとは判定しない", () => {
    expect(isStale(FETCHED, at(-1))).toBe(false);
  });

  it("読めない取得時刻は古いものとして扱う", () => {
    expect(isStale("不明", at(0))).toBe(true);
  });
});
