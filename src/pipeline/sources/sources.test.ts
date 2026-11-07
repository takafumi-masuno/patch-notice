import { describe, expect, it, vi } from "vitest";
import type { Get, Source } from "../types.ts";
import { sources } from "./index.ts";

function source(id: string): Source {
  const found = sources.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`unknown source ${id}`);
  return found;
}

const rss = (items: string) =>
  `<rss version="2.0"><channel>${items}</channel></rss>`;

const item = (title: string, description: string, link = "https://x.test/1") =>
  `<item><title>${title}</title><link>${link}</link><guid>${link}</guid>
   <pubDate>Tue, 20 Oct 2026 12:00:00 +0000</pubDate>
   <description>${description}</description></item>`;

const respond = (body: string): Get => vi.fn(async () => body);

describe("kev", () => {
  const body = JSON.stringify({
    vulnerabilities: [
      {
        cveID: "CVE-2026-1000",
        vendorProject: "Google",
        product: "Chromium V8",
        vulnerabilityName: "Google Chromium V8 Vulnerability",
        dateAdded: "2026-10-20",
        shortDescription: "Out of bounds write.",
        requiredAction: "Apply mitigations under BOD 26-04.",
        dueDate: "2026-11-01",
      },
    ],
  });

  it("悪用済みとして取り込み、製品を判定する", async () => {
    const [entry] = await source("kev").load(respond(body));
    expect(entry.exploited).toBe(true);
    expect(entry.key).toBe("CVE-2026-1000");
    expect(entry.product).toBe("chrome");
  });

  it("米国政府機関向けの対応と期限を本文に入れない", async () => {
    const [entry] = await source("kev").load(respond(body));
    expect(entry.body).not.toContain("BOD");
    expect(entry.body).not.toContain("2026-11-01");
  });

  it("空のカタログはエラーにする", async () => {
    await expect(
      source("kev").load(respond('{"vulnerabilities":[]}')),
    ).rejects.toThrow();
  });
});

describe("cisco", () => {
  it("評価を読み取り、URL の問い合わせ文字列を落とす", async () => {
    const [entry] = await source("cisco").load(
      respond(
        rss(
          item(
            "Cisco Test",
            "Summary. Security Impact Rating: Critical CVE: CVE-2026-2000",
            "https://sec.test/advisory?vs_f=rss&amp;vs_k=1",
          ),
        ),
      ),
    );
    expect(entry.vendorSeverity).toBe("critical");
    expect(entry.url).toBe("https://sec.test/advisory");
  });

  it("Informational は info にする", async () => {
    const [entry] = await source("cisco").load(
      respond(rss(item("Cisco", "Security Impact Rating: Informational"))),
    );
    expect(entry.vendorSeverity).toBe("info");
  });
});

describe("mozilla", () => {
  it("認証局の事案以外の記事は取り込まない", async () => {
    const entries = await source("mozilla").load(
      respond(
        rss(
          item(
            "Compromise of intermediate certificates",
            "Body",
            "https://x.test/ca",
          ) + item("Updated GPG key", "New signing key", "https://x.test/gpg"),
        ),
      ),
    );
    expect(entries.map((entry) => entry.url)).toEqual(["https://x.test/ca"]);
  });
});

describe("jpcert", () => {
  it("Weekly Report を除き、注意喚起に印を付ける", async () => {
    const entries = await source("jpcert").load(
      respond(`<rdf:RDF>
        <item><title>注意喚起: A</title><link>https://x.test/a</link>
        <dc:date>2026-10-20T00:00+09:00</dc:date></item>
        <item><title>Weekly Report: B</title><link>https://x.test/b</link>
        <dc:date>2026-10-20T00:00+09:00</dc:date></item>
        <item><title>分析レポート C</title><link>https://x.test/c</link>
        <dc:date>2026-10-20T00:00+09:00</dc:date></item></rdf:RDF>`),
    );
    expect(entries.map((entry) => entry.nationalAlert)).toEqual([true, false]);
  });
});

describe("chrome", () => {
  const atom = (title: string, content: string) => `<feed><entry>
    <title type="text">${title}</title><id>tag:1</id>
    <link rel="alternate" href="http://chromereleases.test/post"/>
    <published>2026-10-20T00:00:00Z</published>
    <content type="html">${content}</content></entry></feed>`;

  it("デスクトップの Stable 更新からバージョンを読み取る", async () => {
    const [entry] = await source("chrome").load(
      respond(
        atom(
          "Stable Channel Update for Desktop",
          "Updated to 157.0.8103.38 for Windows.",
        ),
      ),
    );
    expect(entry.version).toBe("157.0.8103.38");
    expect(entry.title).toBe("Chrome 157.0.8103.38（Stable）");
    expect(entry.url).toBe("https://chromereleases.test/post");
  });

  it("他のチャネルは取り込まない", async () => {
    const entries = await source("chrome").load(
      respond(atom("Early Stable Update for Desktop", "1.0")),
    );
    expect(entries).toEqual([]);
  });
});

describe("slack", () => {
  it("Security Guidance のある更新だけ取り込む", async () => {
    const entries = await source("slack-windows").load(
      respond(
        rss(
          item(
            "Slack 4.53.280 (2026/11/03)",
            "Security Guidance This release includes security improvements.",
            "https://x.test/sec",
          ) + item("Slack 4.53.283", "Bug fixes.", "https://x.test/fix"),
        ),
      ),
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe("Slack for Windows 4.53.280");
    expect(entries[0].version).toBe("4.53.280");
    expect(entries[0].vendorSeverity).toBeUndefined();
  });

  it("significant は重要な更新として扱う", async () => {
    const [entry] = await source("slack-mac").load(
      respond(
        rss(
          item(
            "Slack 4.52.182",
            "Security Guidance Includes significant security improvements.",
          ),
        ),
      ),
    );
    expect(entry.vendorSeverity).toBe("high");
  });
});

describe("php と python", () => {
  it("セキュリティに関する記事だけ取り込む", async () => {
    const entries = await source("python").load(
      respond(
        rss(
          item("Python 3.15 released", "Security fixes.", "https://x.test/1") +
            item("PyCon news", "Conference.", "https://x.test/2"),
        ),
      ),
    );
    expect(entries).toHaveLength(1);
  });
});

describe("apple", () => {
  it("正式版の OS だけ取り込み、ビルド違いを同じキーにする", async () => {
    const entries = await source("apple").load(
      respond(
        rss(
          item("iOS 27.2 (24B91020)", "", "https://x.test/1") +
            item("iOS 27.2 (24B119)", "", "https://x.test/2") +
            item("iOS 27.3 beta (24C5037i)", "", "https://x.test/3") +
            item("Xcode 27.2", "", "https://x.test/4"),
        ),
      ),
    );
    expect(entries.map((entry) => entry.key)).toEqual(["iOS 27.2", "iOS 27.2"]);
    expect(entries[0].version).toBe("27.2");
  });
});

describe("msrc", () => {
  const update = {
    ID: "2026-Oct",
    InitialReleaseDate: "2026-10-13T07:00:00Z",
    CvrfUrl: "https://api.test/2026-Oct",
  };
  const document = {
    Vulnerability: [
      {
        CVE: "CVE-2026-3000",
        Title: { Value: "Windows Shell Bypass" },
        Notes: [{ Type: 7, Value: "Windows Shell" }],
        Threats: [
          { Type: 1, Description: { Value: "Exploited:Yes" } },
          { Type: 3, Description: { Value: "Critical" } },
        ],
        RevisionHistory: [{ Date: "2026-10-13T07:00:00" }],
      },
      {
        CVE: "CVE-2026-3001",
        Title: { Value: "Microsoft Word Bug" },
        Notes: [{ Type: 7, Value: "Microsoft Office Word" }],
        Threats: [{ Type: 1, Description: { Value: "Exploited:No" } }],
      },
      {
        CVE: "CVE-2026-3002",
        Title: { Value: "Linux kernel issue" },
        Notes: [{ Type: 7, Value: "Mariner" }],
        Threats: [{ Type: 1, Description: { Value: "Exploited:Yes" } }],
      },
    ],
  };
  const get: Get = vi.fn(async (url) =>
    JSON.stringify(url.endsWith("updates") ? { value: [update] } : document),
  );

  it("月例の1件と悪用済みの CVE を取り込み、Linux 向けは除く", async () => {
    const entries = await source("msrc").load(get);
    expect(entries.map((entry) => entry.key)).toEqual([
      "2026-Oct",
      "CVE-2026-3000",
    ]);
    expect(entries[0].cveCount).toBe(2);
    expect(entries[0].vendorSeverity).toBe("critical");
    expect(entries[1].exploited).toBe(true);
    expect(entries[1].product).toBe("windows-office");
  });

  it("JSON を指定して取得する", async () => {
    await source("msrc").load(get);
    expect(get).toHaveBeenCalledWith(update.CvrfUrl, {
      accept: "application/json",
    });
  });
});

describe("共通の入力チェック", () => {
  it("日付が読めない項目と危険なリンクは除く", async () => {
    const entries = await source("wordpress").load(
      respond(
        rss(
          `<item><title>No date</title><link>https://x.test/a</link></item>` +
            item("Bad link", "Body", "javascript:alert(1)") +
            item("Good", "Body", "https://x.test/good"),
        ),
      ),
    );
    expect(entries.map((entry) => entry.title)).toEqual(["Good"]);
  });

  it("全情報源の id が重複しない", () => {
    const ids = sources.map((candidate) => candidate.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
