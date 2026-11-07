import { describe, expect, it } from "vitest";
import { classify, itemId } from "./classify.ts";
import type { Entry } from "./types.ts";

const base: Entry = {
  source: "test",
  key: "k",
  title: "Title",
  url: "https://example.com/",
  publishedAt: "2026-10-20T00:00:00.000Z",
  body: "",
  treatment: "facts",
};
const none = new Set<string>();

describe("緊急度", () => {
  it("KEV の項目は要対応", () => {
    const item = classify({ ...base, source: "kev", exploited: true }, none);
    expect(item.urgency).toBe("action");
    expect(item.exploited).toBe(true);
    expect(item.urgencyReasons).toEqual(["KEV に掲載"]);
  });

  it("Chrome の更新の CVE が KEV にあれば要対応", () => {
    const item = classify(
      {
        ...base,
        source: "chrome",
        product: "chrome",
        body: "Fixes CVE-2026-87491 and CVE-2026-1111.",
      },
      new Set(["CVE-2026-87491"]),
    );
    expect(item.urgency).toBe("action");
    expect(item.exploited).toBe(true);
    expect(item.urgencyReasons).toEqual(["関連する CVE が KEV に掲載"]);
  });

  it("メーカーが悪用を明記していれば要対応", () => {
    const item = classify(
      { ...base, body: "An exploit exists in the wild." },
      none,
    );
    expect(item.urgency).toBe("action");
  });

  it("国内機関の注意喚起は要対応", () => {
    expect(classify({ ...base, nationalAlert: true }, none).urgency).toBe(
      "action",
    );
  });

  it("Cisco の Critical と High は要確認", () => {
    for (const vendorSeverity of ["critical", "high"] as const) {
      expect(classify({ ...base, vendorSeverity }, none).urgency).toBe(
        "review",
      );
    }
  });

  it("上記に当たらなければ通常", () => {
    const item = classify({ ...base, vendorSeverity: "medium" }, none);
    expect(item.urgency).toBe("normal");
    expect(item.urgencyReasons).toEqual([]);
  });

  it("悪用が否定されていれば要対応にしない", () => {
    const item = classify(
      {
        ...base,
        vendorSeverity: "critical",
        body: "These are not known to be actively exploited.",
      },
      none,
    );
    expect(item.urgency).toBe("review");
    expect(item.exploited).toBe(false);
  });
});

describe("eMudhra の事案の再現", () => {
  it("Mozilla Blog の記事は認証局の事案として要確認になる", () => {
    const item = classify(
      {
        ...base,
        source: "mozilla",
        title:
          "Protecting Firefox users following the compromise of eMudhra intermediate certificates",
        body: "Private keys associated with eight intermediate certificates had been compromised.",
        treatment: "ai-summary",
      },
      none,
    );
    expect(item.urgency).toBe("review");
    expect(item.product).toBe("ca-incident");
    expect(item.audience).toBe("both");
  });

  it("Cisco の案内も認証局の事案として要確認になる", () => {
    const item = classify(
      {
        ...base,
        source: "cisco",
        product: "cisco",
        title:
          "Cisco Informational for Emergency Distrust of eMudhra Root and Intermediate Certificate Authorities",
        body: "Security Impact Rating: Informational",
        vendorSeverity: "info",
        treatment: "ai-summary",
      },
      none,
    );
    expect(item.urgency).toBe("review");
    expect(item.product).toBe("ca-incident");
  });

  it("語句の一致だけでは要対応にしない", () => {
    const item = classify(
      {
        ...base,
        title: "Root CA was compromised",
      },
      none,
    );
    expect(item.urgency).toBe("review");
  });

  it("本文で触れただけの製品更新は、製品のまま要確認にする", () => {
    const item = classify(
      {
        ...base,
        source: "python",
        product: "python",
        title: "Python 3.15.2 is out",
        body: "Expedited releases to distrust the compromised intermediate CA keys.",
      },
      none,
    );
    expect(item.urgency).toBe("review");
    expect(item.product).toBe("python");
    expect(item.audience).toBe("it");
  });
});

describe("公開データ", () => {
  it("本文を含めない", () => {
    expect(classify({ ...base, body: "secret" }, none)).not.toHaveProperty(
      "body",
    );
  });

  it("id は情報源とキーから決まる", () => {
    expect(itemId("a", "b")).toBe(itemId("a", "b"));
    expect(itemId("a", "b")).not.toBe(itemId("a", "c"));
    expect(classify(base, none).id).toBe(itemId("test", "k"));
  });

  it("月例更新は CVE を列挙せず件数だけ持つ", () => {
    const item = classify({ ...base, cveCount: 1461 }, none);
    expect(item.cves).toEqual([]);
    expect(item.cveCount).toBe(1461);
  });
});

describe("読者区分と製品", () => {
  it("社員が更新する製品は社員向けも出す", () => {
    const item = classify({ ...base, product: "chrome" }, none);
    expect(item.audience).toBe("both");
  });

  it("Microsoft でもサーバー製品は情シス向けのみ", () => {
    const item = classify(
      {
        ...base,
        product: "windows-office",
        title: "Microsoft SharePoint Code Injection Vulnerability",
      },
      none,
    );
    expect(item.audience).toBe("it");
  });

  it("情報源が製品を決めていなければタイトルから判定する", () => {
    expect(
      classify({ ...base, title: "Oracle Java の脆弱性対策" }, none).product,
    ).toBe("java");
    expect(classify({ ...base, title: "SHIRASAGI" }, none).product).toBe(
      "other",
    );
  });
});
