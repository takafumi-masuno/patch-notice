import { expect, test } from "@playwright/test";
import { XMLParser, XMLValidator } from "fast-xml-parser";

const ROOT = "/patch-notice/";

test("データがなければ準備中を出す", async ({ page }) => {
  for (const url of [ROOT, `${ROOT}certificates/`, `${ROOT}items/preparing/`]) {
    await page.goto(url);
    await expect(page.getByText("現在準備中です。")).toBeVisible();
  }
});

test("データがなくても RSS は正しい XML で、項目は0件", async ({ request }) => {
  const xml = await (await request.get(`${ROOT}feed.xml`)).text();
  expect(XMLValidator.validate(xml)).toBe(true);
  expect(new XMLParser().parse(xml).rss.channel.item).toBeUndefined();
});

test("手元のデータを含まない", async ({ request }) => {
  const html = await (await request.get(ROOT)).text();
  expect(html).not.toContain("result-count");
});
