import { detectProduct } from "../products.ts";
import { toIsoDate } from "../text.ts";
import type { Entry, Source } from "../types.ts";

const URL =
  "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
const CATALOG_URL =
  "https://www.cisa.gov/known-exploited-vulnerabilities-catalog";

interface KevRecord {
  cveID: string;
  vendorProject: string;
  product: string;
  vulnerabilityName: string;
  dateAdded: string;
  shortDescription: string;
}

/** 対応方法と期限は米国政府機関向けの指示なので取り込まない */
export const kev: Source = {
  id: "kev",
  name: "CISA KEV",
  async load(get) {
    const { vulnerabilities } = JSON.parse(await get(URL)) as {
      vulnerabilities: KevRecord[];
    };
    if (!Array.isArray(vulnerabilities) || vulnerabilities.length === 0) {
      throw new Error("KEV catalog is empty");
    }
    return vulnerabilities.flatMap((record): Entry[] => {
      const publishedAt = toIsoDate(record.dateAdded);
      if (!publishedAt) return [];
      return [
        {
          source: "kev",
          key: record.cveID,
          title: record.vulnerabilityName,
          url: CATALOG_URL,
          publishedAt,
          body: `${record.cveID} ${record.vendorProject} ${record.product}: ${record.shortDescription}`,
          treatment: "ai-summary",
          exploited: true,
          product: detectProduct(`${record.vendorProject} ${record.product}`),
        },
      ];
    });
  },
};
