import { readFileSync } from "node:fs";
import path from "node:path";
import type { Item, Status } from "../pipeline/types.ts";

export interface SiteData {
  items: Item[];
  status: Status;
}

function readJson(file: string): unknown {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  return JSON.parse(text);
}

/**
 * ビルド時にデータを読む。data/ がなければ null を返し、画面は準備中になる。
 * 壊れたデータで公開しないよう、形が違う場合はビルドを失敗させる。
 */
export function readSiteData(dir: string): SiteData | null {
  const items = readJson(path.join(dir, "items.json"));
  if (items === undefined) return null;
  if (!Array.isArray(items)) {
    throw new Error(`${dir}/items.json は配列ではありません`);
  }
  if (items.length === 0) return null;

  const status = readJson(path.join(dir, "status.json")) as Status | undefined;
  if (typeof status?.fetchedAt !== "string" || !Array.isArray(status.sources)) {
    throw new Error(`${dir}/status.json の形が正しくありません`);
  }
  return { items: items as Item[], status };
}

let cached: SiteData | null | undefined;

/** ページごとに読み直さないよう、ビルド中は結果を使い回す */
export function siteData(): SiteData | null {
  if (cached === undefined) {
    cached = readSiteData(
      process.env.PATCH_NOTICE_DATA_DIR ?? path.join(process.cwd(), "data"),
    );
  }
  return cached;
}

/** 「直近」の基準。ビルド時刻ではなく取得時刻を使い、古いデータを新しく見せない */
export function referenceTime(status: Status): number {
  return Date.parse(status.fetchedAt);
}

export function sourceName(status: Status, id: string): string {
  return status.sources.find((source) => source.id === id)?.name ?? id;
}
