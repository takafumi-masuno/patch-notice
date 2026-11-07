import { describe, expect, it } from "vitest";
import {
  CERTIFICATE_DEADLINES,
  type CertificateDeadline,
  deadlineState,
  groupDeadlines,
  nextDeadline,
  parseDeadlines,
} from "./certificates.ts";

const entry = (
  overrides: Partial<CertificateDeadline> = {},
): CertificateDeadline => ({
  id: "a",
  date: "2026-12-01",
  kind: "expiry",
  scope: "device",
  title: "題名",
  detail: "内容",
  action: "対応",
  sourceName: "公式",
  sourceUrl: "https://example.com/",
  checkedAt: "2026-11-07",
  ...overrides,
});

const NOW = Date.parse("2026-11-07T12:00:00.000Z");

describe("parseDeadlines", () => {
  it("登録済みのデータは正しい", () => {
    expect(CERTIFICATE_DEADLINES.length).toBeGreaterThan(0);
    expect(new Set(CERTIFICATE_DEADLINES.map((e) => e.id)).size).toBe(
      CERTIFICATE_DEADLINES.length,
    );
  });

  it("日付順に並べる", () => {
    const parsed = parseDeadlines([
      entry({ id: "late", date: "2027-01-01" }),
      entry({ id: "early", date: "2026-01-01" }),
    ]);
    expect(parsed.map((e) => e.id)).toEqual(["early", "late"]);
  });

  it("誤った登録をビルドで止める", () => {
    expect(() => parseDeadlines({})).toThrow();
    expect(() => parseDeadlines([entry({ date: "2026/12/01" })])).toThrow();
    expect(() => parseDeadlines([entry({ checkedAt: "" })])).toThrow();
    expect(() =>
      parseDeadlines([entry({ sourceUrl: "http://example.com/" })]),
    ).toThrow();
    expect(() => parseDeadlines([entry({ action: "" })])).toThrow();
  });
});

describe("期限の状態", () => {
  const deadlines = parseDeadlines([
    entry({ id: "expired", date: "2026-10-19", kind: "expiry" }),
    entry({ id: "applied", date: "2026-03-15", kind: "rule" }),
    entry({ id: "next", date: "2027-03-15", kind: "rule" }),
    entry({ id: "later", date: "2029-03-15", kind: "rule" }),
  ]);
  const state = (id: string) => {
    const target = deadlines.find((e) => e.id === id);
    if (!target) throw new Error(id);
    return deadlineState(target, deadlines, NOW);
  };

  it("種類と日付で状態を決める", () => {
    expect(state("expired")).toBe("expired");
    expect(state("applied")).toBe("applied");
    expect(state("next")).toBe("next");
    expect(state("later")).toBe("upcoming");
  });

  it("当日は日本時間で判定し、期限内として扱う", () => {
    // 2026-12-01 00:30 JST
    const now = Date.parse("2026-11-30T15:30:00.000Z");
    const list = [entry({ date: "2026-12-01" })];
    expect(nextDeadline(list, now)?.id).toBe("a");
    expect(deadlineState(list[0], list, now)).toBe("next");
    // 2026-12-02 00:30 JST
    const after = Date.parse("2026-12-01T15:30:00.000Z");
    expect(nextDeadline(list, after)).toBeUndefined();
    expect(deadlineState(list[0], list, after)).toBe("expired");
  });

  it("残りの期限を先に、経過した項目を新しい順に分ける", () => {
    const { upcoming, past } = groupDeadlines(deadlines, NOW);
    expect(upcoming.map((e) => e.id)).toEqual(["next", "later"]);
    expect(past.map((e) => e.id)).toEqual(["expired", "applied"]);
  });
});
