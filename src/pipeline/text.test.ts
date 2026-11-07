import { describe, expect, it } from "vitest";
import {
  extractCves,
  htmlToText,
  isCaIncident,
  mentionsExploitation,
  safeUrl,
  toIsoDate,
} from "./text.ts";

describe("htmlToText", () => {
  it("タグと実体参照を取り除く", () => {
    expect(htmlToText("<p>A &amp; B</p><script>x()</script>")).toBe("A & B");
  });

  it("二重にエスケープされた HTML を読める", () => {
    expect(htmlToText("&amp;lt;b&amp;gt;bold&amp;lt;/b&amp;gt;")).toBe("bold");
  });

  it("CDATA を読める", () => {
    expect(htmlToText("<![CDATA[<p>text</p>]]>")).toBe("text");
  });
});

describe("extractCves", () => {
  it("重複をなくして大文字にそろえる", () => {
    expect(extractCves("cve-2026-1234 CVE-2026-1234 CVE-2025-99999")).toEqual([
      "CVE-2025-99999",
      "CVE-2026-1234",
    ]);
  });
});

describe("mentionsExploitation", () => {
  it("悪用の明記を検出する", () => {
    expect(
      mentionsExploitation(
        "Google is aware that an exploit exists in the wild.",
      ),
    ).toBe(true);
    expect(mentionsExploitation("Two of them are actively exploited.")).toBe(
      true,
    );
  });

  it("否定文は悪用の明記にしない", () => {
    expect(
      mentionsExploitation("These are not known to be actively exploited."),
    ).toBe(false);
  });

  it("仮定の文は悪用の明記にしない", () => {
    expect(
      mentionsExploitation(
        "We may release earlier should evidence of active exploitation appear.",
      ),
    ).toBe(false);
  });
});

describe("isCaIncident", () => {
  it("認証局の語と事案の語が同じ文にあれば一致する", () => {
    expect(
      isCaIncident(
        "Private keys of intermediate certificates were compromised.",
      ),
    ).toBe(true);
    expect(isCaIncident("認証局の秘密鍵が危殆化しました。")).toBe(true);
  });

  it("別々の文にあるだけでは一致しない", () => {
    expect(
      isCaIncident("We updated the root CA policy. A server was compromised."),
    ).toBe(false);
  });

  it("運用方針の話題には一致しない", () => {
    expect(isCaIncident("Mozilla published a new root store policy.")).toBe(
      false,
    );
  });
});

describe("safeUrl", () => {
  it("http を https に上げる", () => {
    expect(safeUrl("http://example.com/a")).toBe("https://example.com/a");
  });

  it("リンクにできないスキームは捨てる", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("not a url")).toBeNull();
  });
});

describe("toIsoDate", () => {
  it("RSS と ISO の日付を読める", () => {
    expect(toIsoDate("Tue, 20 Oct 2026 12:54:54 +0000")).toBe(
      "2026-10-20T12:54:54.000Z",
    );
    expect(toIsoDate("2026-11-05T09:52+09:00")).toBe(
      "2026-11-05T00:52:00.000Z",
    );
  });

  it("読めない日付は null にする", () => {
    expect(toIsoDate("")).toBeNull();
  });
});
