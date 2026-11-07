import { describe, expect, it, vi } from "vitest";
import type { Get } from "../types.ts";
import { sources } from "./index.ts";

const NOW = new Date("2026-11-08T00:00:00Z");

function source(id: string) {
  const found = sources.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`unknown source ${id}`);
  return { load: (get: Get) => found.load(get, NOW) };
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

describe("php", () => {
  it("セキュリティに関する記事だけ取り込む", async () => {
    const entries = await source("php").load(
      respond(
        rss(
          item("PHP 8.5.1 released", "Security fixes.", "https://x.test/1") +
            item("PHP conference", "Conference.", "https://x.test/2"),
        ),
      ),
    );
    expect(entries).toHaveLength(1);
  });
});

describe("掲載しない情報源", () => {
  it("利用条件の懸念がある情報源を取得しない", () => {
    const ids = sources.map((candidate) => candidate.id);
    for (const excluded of ["cisco", "msrc", "apple", "python"]) {
      expect(ids).not.toContain(excluded);
    }
  });

  it("除外した提供元へ通信する URL を持たない", async () => {
    const urls: string[] = [];
    const get: Get = async (url) => {
      urls.push(url);
      throw new Error("stop");
    };
    await Promise.allSettled(
      sources.map((candidate) => candidate.load(get, NOW)),
    );
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url).not.toMatch(/cisco|microsoft|apple|python\.org/);
    }
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
