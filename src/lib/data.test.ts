import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  loadSiteData,
  readSiteData,
  referenceTime,
  sourceName,
} from "./data.ts";

const STATUS = {
  fetchedAt: "2026-11-07T00:00:00.000Z",
  sources: [
    {
      id: "kev",
      name: "CISA KEV",
      ok: true,
      notModified: false,
      entries: 1,
      items: 1,
    },
  ],
};

let dir: string;
const write = (name: string, value: unknown) =>
  writeFileSync(
    path.join(dir, name),
    typeof value === "string" ? value : JSON.stringify(value),
  );

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "patch-notice-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true });
});

describe("readSiteData", () => {
  it("データがなければ null を返す", () => {
    expect(readSiteData(path.join(dir, "missing"))).toBeNull();
    expect(readSiteData(dir)).toBeNull();
  });

  it("項目が0件なら null を返す", () => {
    write("items.json", []);
    expect(readSiteData(dir)).toBeNull();
  });

  it("項目と状態を読む", () => {
    write("items.json", [{ id: "1" }]);
    write("status.json", STATUS);
    expect(readSiteData(dir)?.items).toHaveLength(1);
  });

  it("壊れた JSON はビルドを止める", () => {
    write("items.json", "{");
    expect(() => readSiteData(dir)).toThrow();
  });

  it("形の違うデータはビルドを止める", () => {
    write("items.json", { id: "1" });
    expect(() => readSiteData(dir)).toThrow(/配列/);
  });

  it("項目があるのに状態がなければビルドを止める", () => {
    write("items.json", [{ id: "1" }]);
    expect(() => readSiteData(dir)).toThrow(/status.json/);
  });
});

describe("loadSiteData", () => {
  it("必須でなければ、データなしを準備中として扱う", () => {
    expect(loadSiteData(dir, false)).toBeNull();
  });

  it("公開用のビルドでは、データなしでビルドを止める", () => {
    expect(() => loadSiteData(dir, true)).toThrow(/データがありません/);
  });

  it("公開用のビルドでは、0件のデータでもビルドを止める", () => {
    write("items.json", []);
    expect(() => loadSiteData(dir, true)).toThrow(/データがありません/);
  });

  it("データがあれば、必須でも読み込む", () => {
    write("items.json", [{ id: "1" }]);
    write("status.json", STATUS);
    expect(loadSiteData(dir, true)?.items).toHaveLength(1);
  });
});

describe("データの補助", () => {
  it("取得時刻を基準にする", () => {
    expect(referenceTime(STATUS)).toBe(Date.parse(STATUS.fetchedAt));
  });

  it("情報源の名前を返し、不明なら ID を返す", () => {
    expect(sourceName(STATUS, "kev")).toBe("CISA KEV");
    expect(sourceName(STATUS, "unknown")).toBe("unknown");
  });
});
