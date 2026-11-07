import { describe, expect, it } from "vitest";
import { checkSummary } from "./check.ts";

const source = {
  title: "ExampleOS Web UI Path Traversal Vulnerability",
  body: "CVE-2026-12345 affects ExampleOS 11.2.3. An authenticated attacker can read files via open source components.",
  exploited: false,
};

const good =
  "ExampleOS 11.2.3 の Web UI にパストラバーサルの脆弱性があります。認証済みの攻撃者がファイルを読み取れるおそれがあります。";

const problemsOf = (summary: string, exploited = false) =>
  checkSummary({ ...source, exploited }, summary);

describe("checkSummary", () => {
  it("元データの事実だけの要約は通す", () => {
    expect(problemsOf(good)).toEqual([]);
  });

  it("元データにある CVE 番号は通す", () => {
    expect(problemsOf(`CVE-2026-12345 が報告されています。${good}`)).toEqual(
      [],
    );
  });

  it("元データにない CVE 番号を落とす", () => {
    expect(problemsOf(`CVE-2026-99999 の問題です。${good}`)).toContain(
      "cve:CVE-2026-99999",
    );
  });

  it("崩れた CVE 番号を落とす", () => {
    expect(problemsOf(`CVE-2026,12345 の問題です。${good}`)).toContain(
      "cve-malformed:CVE-2026,12345",
    );
  });

  it("元データにないバージョンを落とす", () => {
    expect(problemsOf(`修正版は 11.2.4 です。${good}`)).toContain(
      "version:11.2.4",
    );
  });

  it("バージョンの一部だけが一致しても落とす", () => {
    expect(problemsOf(`影響は 1.2.3 です。${good}`)).toContain("version:1.2.3");
  });

  it("元データにない英単語を落とす", () => {
    expect(problemsOf(`セキュリティinfluenceがあります。${good}`)).toContain(
      "word:influence",
    );
  });

  it("URL を落とす", () => {
    expect(problemsOf(`${good}詳細は www.example.com です。`)).toContain("url");
  });

  it.each([
    "パッチの適用を推奨します。",
    "更新してください。",
    "アクセスを制限する必要があります。",
  ])("助言を落とす: %s", (advice) => {
    expect(problemsOf(`${good}${advice}`)).toContain("advice");
  });

  it("入力元への言及を落とす", () => {
    expect(problemsOf(`提供された情報によると、${good}`)).toContain(
      "source-leak",
    );
    expect(problemsOf(`${good}</source>`)).toContain("source-leak");
  });

  it("「オープンソース」や「ソースコード」は入力元の言及として扱わない", () => {
    expect(problemsOf(`オープンソースの部品に問題があります。${good}`)).toEqual(
      [],
    );
    expect(problemsOf(`ソースコードに問題があります。${good}`)).toEqual([]);
  });

  it("分からないと書いた要約を落とす", () => {
    expect(problemsOf(`影響範囲は記載されていません。${good}`)).toContain(
      "mentions-missing",
    );
  });

  it("悪用の情報があるのに書いていない要約を落とす", () => {
    expect(problemsOf(good, true)).toContain("exploit-missing");
  });

  it("悪用の情報があり、書いていれば通す", () => {
    expect(problemsOf(`${good}悪用が確認されています。`, true)).toEqual([]);
  });

  it("悪用の情報がないのに有無に触れた要約を落とす", () => {
    expect(problemsOf(`${good}悪用は確認されていません。`)).toContain(
      "exploit-unsupported",
    );
  });

  it("日本語でない要約を落とす", () => {
    expect(
      problemsOf("ExampleOS affects files and attacker can read files."),
    ).toContain("not-japanese");
  });

  it("短すぎる要約と長すぎる要約を落とす", () => {
    expect(problemsOf("問題があります。")).toContain("too-short");
    expect(problemsOf("あ".repeat(501))).toContain("too-long");
  });
});
