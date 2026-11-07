import { describe, expect, it } from "vitest";
import { sources } from "../pipeline/sources/index.ts";
import { SOURCE_CREDITS, UNFETCHED_PRODUCTS } from "./credits.ts";
import { isHttpsUrl } from "./site.ts";

describe("SOURCE_CREDITS", () => {
  it("取得するすべての情報源に帰属表示がある", () => {
    for (const source of sources) {
      expect(SOURCE_CREDITS[source.id], source.id).toBeDefined();
    }
  });

  it("取得していない情報源を載せない", () => {
    const ids = sources.map((source) => source.id);
    expect(Object.keys(SOURCE_CREDITS).sort()).toEqual([...ids].sort());
  });

  it("リンクはすべて https にする", () => {
    for (const credit of Object.values(SOURCE_CREDITS)) {
      expect(isHttpsUrl(credit.url), credit.name).toBe(true);
      if (credit.licenseUrl) {
        expect(isHttpsUrl(credit.licenseUrl), credit.name).toBe(true);
      }
    }
  });
});

describe("UNFETCHED_PRODUCTS", () => {
  it("公式情報のリンクはすべて https にする", () => {
    for (const link of UNFETCHED_PRODUCTS) {
      expect(isHttpsUrl(link.url), link.name).toBe(true);
    }
  });
});
