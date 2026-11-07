import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { XMLParser, XMLValidator } from "fast-xml-parser";

const ROOT = "/patch-notice/";
const item = (number: number) => `${ROOT}items/a00000000000000${number}/`;

const PAGES = [
  ROOT,
  `${ROOT}certificates/`,
  `${ROOT}sources/`,
  item(1),
  item(2),
  item(3),
  item(5),
  item(8),
  `${ROOT}missing/`,
];

const count = (page: Page) => page.getByTestId("result-count");

async function expectNoOverflow(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe("ダッシュボード", () => {
  test("直近7日の件数と要対応を先頭に出す", async ({ page }) => {
    await page.goto(ROOT);
    await expect(page.getByText("最終更新 2026/11/07 12:00 JST")).toBeVisible();
    const tile = (label: string) =>
      page.locator("dl > div").filter({ hasText: label }).locator("dd").first();
    await expect(tile("要対応（直近7日）")).toHaveText("2 件");
    await expect(tile("要確認（直近7日）")).toHaveText("1 件");
    await expect(tile("悪用確認（直近7日）")).toHaveText("2 件");
    await expect(tile("次の証明書の期限")).toHaveText("2027/03/15");
    const priority = page.locator("section[aria-labelledby=priority] h3");
    await expect(priority).toHaveCount(3);
    await expect(priority.first()).toHaveText("サンプル ブラウザの更新 1.2.3");
  });

  test("取得に失敗した情報源を表示する", async ({ page }) => {
    await page.goto(ROOT);
    await expect(page.getByRole("status")).toContainText("停止中の配信");
  });
});

test.describe("ダッシュボードの要約", () => {
  test("AI の要約にだけ AI 要約の表示を付ける", async ({ page }) => {
    await page.goto(ROOT);
    const cards = page.locator("section[aria-labelledby=priority] li");
    await expect(cards.nth(0)).toContainText("AI 要約: サンプルの要約です");
    await expect(cards.nth(1)).toContainText("手動で書いたサンプルの要約");
    await expect(cards.nth(1)).not.toContainText("AI 要約");
  });
});

test.describe("サイト内の移動", () => {
  test("画面を移動しても読み込みエラーが出ない", async ({ page }) => {
    const failed: string[] = [];
    page.on("response", (response) => {
      if (response.status() >= 400) failed.push(response.url());
    });
    await page.goto(ROOT);
    await page.getByRole("link", { name: "証明書" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("証明書");
    await page.getByRole("link", { name: "サンプル認証局の信頼停止" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "サンプル認証局の信頼停止",
    );
    await page.getByRole("link", { name: "一覧へ戻る" }).click();
    await expect(count(page)).toHaveText("8 件");
    expect(failed).toEqual([]);
  });
});

test.describe("絞り込み", () => {
  test("条件で絞り、URL に残し、解除できる", async ({ page }) => {
    await page.goto(ROOT);
    await expect(count(page)).toHaveText("8 件");

    await page.getByLabel("緊急度").selectOption("action");
    await expect(count(page)).toHaveText("3 件");
    await expect(page).toHaveURL(/\?urgency=action$/);

    await page.getByLabel("製品").selectOption("cisco");
    await expect(count(page)).toHaveText("1 件");

    await page.getByRole("button", { name: "条件を解除" }).click();
    await expect(count(page)).toHaveText("8 件");
    await expect(page).toHaveURL(new RegExp(`${ROOT}$`));
  });

  test("CVE 番号で探せる", async ({ page }) => {
    await page.goto(ROOT);
    await page.getByLabel("語句、CVE 番号").fill("cve-2026-1022");
    await expect(count(page)).toHaveText("1 件");
  });

  test("条件に合わなければ案内を出す", async ({ page }) => {
    await page.goto(ROOT);
    await page.getByLabel("語句、CVE 番号").fill("存在しない語句");
    await expect(count(page)).toHaveText("0 件");
    await expect(page.getByText("条件に合う情報はありません。")).toBeVisible();
  });

  test("URL の条件を開いたときに反映する", async ({ page }) => {
    await page.goto(`${ROOT}?period=7&audience=both`);
    await expect(count(page)).toHaveText("1 件");
    await expect(page.getByLabel("期間")).toHaveValue("7");
  });

  test("期間はビルドや閲覧の時刻ではなく、データの取得時刻を基準にする", async ({
    page,
  }) => {
    // サンプル言語の更新は、取得時刻の6日23時間前に公開された項目
    await page.goto(`${ROOT}?period=7`);
    await expect(count(page)).toHaveText("4 件");
    await page.goto(`${ROOT}?period=30`);
    await expect(count(page)).toHaveText("6 件");
  });

  test("知らない条件は無視する", async ({ page }) => {
    await page.goto(`${ROOT}?urgency=unknown`);
    await expect(count(page)).toHaveText("8 件");
  });
});

test.describe("詳細", () => {
  test("悪用の状況を要約と別の欄に出す", async ({ page }) => {
    await page.goto(item(1));
    const section = page.getByRole("region", { name: "悪用の状況" });
    await expect(section.getByText("悪用確認")).toBeVisible();
    await page.goto(item(2));
    await expect(
      page.getByRole("region", { name: "悪用の状況" }),
    ).toContainText("すべての CVE が悪用されているとは限りません");
    await page.goto(item(4));
    await expect(
      page.getByRole("region", { name: "悪用の状況" }),
    ).toContainText("悪用がないことを示すものではありません");
  });

  test("要約の作り方を区別して表示する", async ({ page }) => {
    const summary = () => page.getByRole("region", { name: "概要" });
    await page.goto(item(1));
    await expect(summary()).toContainText("AI 要約（claude-sonnet-5-5）");
    await page.goto(item(2));
    await expect(summary()).toContainText("手動で作成した要約");
    await page.goto(item(4));
    await expect(summary()).toContainText("AI は使っていません");
  });

  test("社員向けの周知文は対象の製品にだけ出す", async ({ page }) => {
    await page.goto(item(1));
    await expect(
      page.getByRole("region", { name: "社員向けの周知文" }),
    ).toBeVisible();
    await page.goto(item(2));
    await expect(
      page.getByRole("region", { name: "社員向けの周知文" }),
    ).toHaveCount(0);
  });

  test("公式リンクと出典を出す", async ({ page }) => {
    await page.goto(item(1));
    await expect(page.getByText("出典: サンプル配信")).toBeVisible();
    const link = page.getByRole("link", { name: /公式情報を開く/ });
    await expect(link).toHaveAttribute(
      "href",
      "https://example.com/advisory/1",
    );
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("多い CVE は折りたたむ", async ({ page }) => {
    await page.goto(item(8));
    await expect(page.getByText("CVE-2026-1019")).toBeVisible();
    await expect(page.getByText("CVE-2026-1020")).toBeHidden();
    await page.getByText("残り 3 件を表示").click();
    await expect(page.getByText("CVE-2026-1022")).toBeVisible();
  });
});

test.describe("コピー", () => {
  test("クリップボードに周知文を入れる", async ({ page, context, baseURL }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: baseURL,
    });
    await page.goto(item(1));
    await page.getByRole("button", { name: "社員向けの文をコピー" }).click();
    await expect(page.getByText("コピーしました")).toBeVisible();
    const employee = await page.evaluate(() => navigator.clipboard.readText());
    expect(employee).toContain("件名: 【要対応】Google Chromeの更新のお願い");
    expect(employee).not.toContain("サンプルの要約");

    await page.getByRole("button", { name: "情シス向けの文をコピー" }).click();
    const it = await page.evaluate(() => navigator.clipboard.readText());
    expect(it).toContain("公式情報: https://example.com/advisory/1");
    expect(it).not.toContain("サンプルの要約");
  });

  test("コピーできないときは失敗を伝える", async ({ page }) => {
    await page.addInitScript(() => {
      navigator.clipboard.writeText = () => Promise.reject(new Error("denied"));
    });
    await page.goto(item(1));
    await page.getByRole("button", { name: "社員向けの文をコピー" }).click();
    await expect(page.getByText("コピーできませんでした")).toBeVisible();
  });
});

test.describe("安全な表示", () => {
  test("取得した文字列を HTML として扱わない", async ({ page }) => {
    let dialog = false;
    page.on("dialog", () => {
      dialog = true;
    });
    for (const url of [ROOT, item(3)]) {
      await page.goto(url);
      expect(await page.evaluate(() => "__xss" in window)).toBe(false);
    }
    expect(dialog).toBe(false);
    await expect(page.locator("main script")).toHaveCount(0);
    await expect(page.locator("main img")).toHaveCount(0);
    await expect(page.locator("main b")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "<script>",
    );
  });

  test("https でないリンクは出さない", async ({ page }) => {
    await page.goto(item(3));
    await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
    await expect(
      page.getByText("公式情報のリンクは表示できません。"),
    ).toBeVisible();
  });
});

test.describe("証明書", () => {
  test("次の期限を先に、経過した期限を後に出す", async ({ page }) => {
    await page.goto(`${ROOT}certificates/`);
    const upcoming = page.getByRole("region", { name: "これからの期限" });
    await expect(upcoming.getByText("次の期限")).toHaveCount(1);
    await expect(upcoming.locator("li").first()).toContainText("2027/03/15");
    const past = page.getByRole("region", { name: "経過した期限" });
    await expect(past.locator("li").first()).toContainText("2026/10/19");
    await expect(past.getByText("期限経過").first()).toBeVisible();
    await expect(past.getByText("適用済み")).toHaveCount(1);
  });

  test("認証局の事案を別枠で出す", async ({ page }) => {
    await page.goto(`${ROOT}certificates/`);
    const incidents = page.getByRole("region", { name: "認証局の事案" });
    await expect(incidents.getByRole("listitem")).toHaveCount(1);
    await expect(incidents).toContainText("サンプル認証局の信頼停止");
    await expect(incidents).toContainText("要確認");
  });
});

test.describe("更新停止の警告", () => {
  const warning = (page: Page) =>
    page.getByText("データの更新が止まっています");

  test("取得から24時間以内は出さない", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-11-08T02:59:00.000Z"));
    await page.goto(ROOT);
    await expect(page.getByTestId("result-count")).toBeVisible();
    await expect(warning(page)).toHaveCount(0);
  });

  test("24時間を過ぎたら、どのページでも最終更新とともに出す", async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date("2026-11-08T03:01:00.000Z"));
    for (const url of [ROOT, item(1), `${ROOT}certificates/`]) {
      await page.goto(url);
      await expect(warning(page)).toContainText("2026/11/07 12:00 JST");
    }
  });
});

test.describe("出典", () => {
  test("カード、一覧、RSS に情報源の名前を出す", async ({ page, request }) => {
    await page.goto(ROOT);
    const card = page.locator("section[aria-labelledby=priority] li").first();
    await expect(card).toContainText("出典: サンプル配信");
    await expect(page.locator("tbody tr").first()).toContainText(
      "出典: サンプル配信",
    );
    const xml = await (await request.get(`${ROOT}feed.xml`)).text();
    const { rss } = new XMLParser().parse(xml);
    expect(rss.channel.item[0].description).toContain("（出典: サンプル配信）");
  });

  test("情報源のページに帰属表示と、取得していない製品の案内を出す", async ({
    page,
  }) => {
    await page.goto(ROOT);
    await page.getByRole("link", { name: "情報源" }).click();
    await expect(page).toHaveURL(/\/patch-notice\/sources\/$/);
    await expect(page.getByText("© The Kubernetes Authors")).toBeVisible();
    await expect(page.getByRole("link", { name: /CC BY 4.0/ })).toHaveAttribute(
      "href",
      "https://creativecommons.org/licenses/by/4.0/",
    );
    const unfetched = page.locator("section[aria-labelledby=unfetched]");
    await expect(unfetched.getByRole("listitem")).toHaveCount(4);
  });
});

test.describe("RSS", () => {
  for (const [path, expected] of [
    ["feed.xml", 8],
    ["feed-action.xml", 3],
  ] as const) {
    test(`${path} は正しい XML で、公開サイトのリンクを持つ`, async ({
      request,
    }) => {
      const response = await request.get(`${ROOT}${path}`);
      expect(response.ok()).toBe(true);
      const xml = await response.text();
      expect(XMLValidator.validate(xml)).toBe(true);
      expect(xml).not.toContain("<script>");
      const { rss } = new XMLParser().parse(xml);
      expect(rss.channel.item).toHaveLength(expected);
      expect(rss.channel.item[0].link).toMatch(
        /^https:\/\/takafumi-masuno\.github\.io\/patch-notice\/items\//,
      );
    });
  }

  test("ページから RSS を見つけられる", async ({ page }) => {
    await page.goto(ROOT);
    await expect(
      page.locator('link[rel=alternate][type="application/rss+xml"]'),
    ).toHaveCount(2);
  });
});

test("存在しないページは掲載終了の可能性を案内する", async ({ page }) => {
  const response = await page.goto(`${ROOT}items/unknown/`);
  expect(response?.status()).toBe(404);
  await expect(page.getByText("掲載から90日を過ぎた情報")).toBeVisible();
});

test("検索結果に載せない設定を保つ", async ({ page }) => {
  await page.goto(ROOT);
  await expect(page.locator("meta[name=robots]")).toHaveAttribute(
    "content",
    /noindex/,
  );
});

for (const url of PAGES) {
  test(`${url} はアクセシビリティの違反がなく、横にはみ出さない`, async ({
    page,
  }) => {
    await page.goto(url);
    await expectNoOverflow(page);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}
