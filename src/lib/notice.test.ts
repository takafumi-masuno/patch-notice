import { describe, expect, it } from "vitest";
import { audienceFor } from "../pipeline/products.ts";
import { RELATED_KEV_REASON } from "../pipeline/reasons.ts";
import type { Item, ProductId, Urgency } from "../pipeline/types.ts";
import {
  EXPLOITATION_LABELS,
  employeeCopyText,
  exploitationStatus,
  itCopyText,
  noticeFor,
  PRODUCT_NAMES,
  productLabel,
} from "./notice.ts";

const item = (overrides: Partial<Item> = {}): Item => ({
  id: "1",
  source: "kev",
  product: "chrome",
  title: "Title",
  url: "https://example.com/",
  publishedAt: "2026-11-01T00:00:00.000Z",
  cves: [],
  cveCount: 0,
  exploited: false,
  urgency: "normal",
  urgencyReasons: [],
  audience: "both",
  treatment: "facts",
  ...overrides,
});

const PRODUCTS = Object.keys(PRODUCT_NAMES) as ProductId[];
const URGENCIES: Urgency[] = ["action", "review", "normal"];

describe("exploitationStatus", () => {
  it("悪用の根拠で3つに分ける", () => {
    expect(exploitationStatus(item({ exploited: true }))).toBe("confirmed");
    expect(
      exploitationStatus(
        item({ exploited: true, urgencyReasons: [RELATED_KEV_REASON] }),
      ),
    ).toBe("related");
    expect(exploitationStatus(item())).toBe("none");
  });

  it("確認できていない項目を悪用なしと断定しない", () => {
    expect(EXPLOITATION_LABELS.none).toBe("確認情報なし");
    expect(Object.values(EXPLOITATION_LABELS).join()).not.toContain("悪用なし");
  });
});

describe("productLabel", () => {
  it("その他の製品は一覧向けの語にする", () => {
    expect(productLabel("other")).toBe("その他");
    expect(productLabel("chrome")).toBe(PRODUCT_NAMES.chrome);
  });
});

describe("コピーする文", () => {
  const ai = item({ summary: { text: "AI の要約", origin: "ai" } });

  it("情シス向けに題名、対応、公式リンクを入れ、AI の要約は入れない", () => {
    const text = itCopyText(ai, noticeFor(ai));
    expect(text).toContain("Title");
    expect(text).toContain(noticeFor(ai).itAction);
    expect(text).toContain("公式情報: https://example.com/");
    expect(text).not.toContain("AI の要約");
  });

  it("https でないリンクはコピーする文に入れない", () => {
    const unsafe = item({ url: "javascript:alert(1)" });
    expect(itCopyText(unsafe, noticeFor(unsafe))).not.toContain("javascript");
  });

  it("社員向けに件名と本文を入れる", () => {
    expect(employeeCopyText({ subject: "件名A", body: "本文B" })).toBe(
      "件名: 件名A\n\n本文B",
    );
  });
});

describe("noticeFor", () => {
  it("全ての製品と緊急度で、情シスの対応と要約を出す", () => {
    for (const product of PRODUCTS) {
      for (const urgency of URGENCIES) {
        for (const exploited of [true, false]) {
          const audience = audienceFor(product, "title");
          const notice = noticeFor(
            item({ product, urgency, exploited, audience }),
          );
          const text = JSON.stringify(notice);
          expect(notice.summary).not.toBe("");
          expect(notice.itAction).not.toBe("");
          expect(text).not.toContain("undefined");
          expect(notice.employee !== undefined).toBe(audience === "both");
        }
      }
    }
  });

  it("要約がなければ公開データの事実から文を作る", () => {
    const notice = noticeFor(
      item({
        product: "php",
        version: "8.4.1",
        cveCount: 2,
        exploited: true,
        vendorSeverity: "critical",
      }),
    );
    expect(notice.summaryOrigin).toBe("facts");
    expect(notice.summary).toBe(
      "PHPに関する公開情報です。バージョンは 8.4.1 です。CVE は 2 件です。悪用が確認されています。メーカーの評価は critical です。",
    );
  });

  it("AI の要約があれば表示し、実際のモデルも返す", () => {
    const notice = noticeFor(
      item({
        summary: {
          text: "AI の要約です。",
          origin: "ai",
          model: "claude-sonnet-5",
        },
      }),
    );
    expect(notice).toMatchObject({
      summary: "AI の要約です。",
      summaryOrigin: "ai",
      summaryModel: "claude-sonnet-5",
    });
  });

  it("情シスの対応と社員向けの文に AI の要約を混ぜない", () => {
    const text = "AI が書いた本文";
    const notice = noticeFor(item({ summary: { text, origin: "ai" } }));
    expect(notice.itAction).not.toContain(text);
    expect(notice.employee?.body).not.toContain(text);
  });

  it("社員向けの文に版数を入れる", () => {
    const notice = noticeFor(item({ version: "150.0.1000.1" }));
    expect(notice.employee?.body).toContain("150.0.1000.1 以上");
  });

  it("版数がなければ社員向けの文に確認の行を入れない", () => {
    expect(noticeFor(item()).employee?.body).not.toContain("以上か確認");
  });

  it("悪用があれば社員向けの文に書く", () => {
    const notice = noticeFor(item({ urgency: "action", exploited: true }));
    expect(notice.employee?.subject).toBe(
      "【要対応】Google Chromeの更新のお願い",
    );
    expect(notice.employee?.body).toContain("悪用が確認されています");
  });

  it("関連する CVE が KEV にある項目は、項目全体の悪用と断定しない", () => {
    const notice = noticeFor(
      item({
        product: "cisco",
        audience: "it",
        urgency: "action",
        exploited: true,
        urgencyReasons: [RELATED_KEV_REASON],
      }),
    );
    expect(notice.summary).toContain("関連する CVE の悪用が確認されています。");
    expect(notice.itAction).toContain(
      "関連する CVE の悪用が確認されています。",
    );
  });

  it("情シス向けのみの製品には社員向けの文を出さない", () => {
    const notice = noticeFor(item({ product: "cisco", audience: "it" }));
    expect(notice.employee).toBeUndefined();
  });

  it("Microsoft のサーバー製品は情シス向けのみにする", () => {
    const notice = noticeFor(
      item({ product: "windows-office", audience: "it" }),
    );
    expect(notice.employee).toBeUndefined();
    expect(notice.itAction).toContain("WSUS");
  });

  it("認証局の事案では社員に操作を求めない", () => {
    const notice = noticeFor(item({ product: "ca-incident" }));
    expect(notice.employee?.body).toContain("操作は必要ありません");
    expect(notice.itAction).toContain("証明書");
  });

  it("悪用のない要対応は国内機関の注意喚起として案内する", () => {
    const notice = noticeFor(item({ product: "other", urgency: "action" }));
    expect(notice.itAction).toContain("注意喚起");
  });

  it("修正版の有無を定型文で断定しない", () => {
    const notice = noticeFor(item({ urgency: "action", exploited: true }));
    expect(notice.itAction).toContain("公式情報で修正版と回避策を確認");
  });
});
