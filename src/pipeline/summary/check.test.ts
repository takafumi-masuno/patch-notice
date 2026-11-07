import { describe, expect, it } from "vitest";
import { checkSummary } from "./check.ts";

const source = {
  title: "ExampleOS Web UI Path Traversal Vulnerability",
  body: "CVE-2026-12345 affects ExampleOS 11.2.3. An authenticated attacker can read files via open source components.",
};

const good =
  "ExampleOS 11.2.3 の Web UI にパストラバーサルの脆弱性があります。認証済みの攻撃者がファイルを読み取れるおそれがあります。";

const problemsOf = (summary: string) => checkSummary(source, summary);

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

  it("元データの語の略語は通す", () => {
    const denial = {
      ...source,
      body: `${source.body} A server-side request forgery or denial-of-service condition.`,
    };
    expect(checkSummary(denial, `${good}DoS のおそれがあります。`)).toEqual([]);
    expect(checkSummary(denial, `${good}SSRF のおそれがあります。`)).toEqual(
      [],
    );
  });

  it("元データの語に対応しない略語は落とす", () => {
    expect(problemsOf(`${good}DoS のおそれがあります。`)).toContain("word:DoS");
    expect(problemsOf(`${good}SSRF のおそれがあります。`)).toContain(
      "word:SSRF",
    );
  });

  it("語の頭文字が偶然並ぶだけの製品名は通さない", () => {
    const email = {
      ...source,
      body: `${source.body} It is in Cisco Secure Email.`,
    };
    expect(checkSummary(email, `${good}Cisco ISE の問題です。`)).toContain(
      "word:ISE",
    );
  });

  it("綴りの誤りは略語として通さない", () => {
    expect(problemsOf(`${good}Enginee の問題です。`)).toContain("word:Enginee");
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

  it("「リソース」は入力元の言及として扱わない", () => {
    expect(problemsOf(`リソースを読み取れます。${good}`)).toEqual([]);
  });

  it("単独の「ソース」は入力元の言及として落とす", () => {
    expect(problemsOf(`ソースによると、${good}`)).toContain("source-leak");
  });

  it("分からないと書いた要約を落とす", () => {
    expect(problemsOf(`影響範囲は記載されていません。${good}`)).toContain(
      "mentions-missing",
    );
  });

  it.each([
    "悪用が確認されています。",
    "これらの脆弱性は実際に悪用が確認されています。",
    "悪用は確認されていません。",
    "この脆弱性は悪用されています。",
    "すでに悪用されており、被害が出ています。",
    "悪用の有無は不明です。",
  ])("悪用の状況を書いた要約を落とす: %s", (claim) => {
    expect(problemsOf(`${good}${claim}`)).toContain("exploit-claim");
  });

  it("攻撃の仕組みとしての「悪用すると」は通す", () => {
    expect(
      problemsOf(`${good}攻撃者が悪用すると、ファイルを読み取れます。`),
    ).toEqual([]);
  });

  it.each([
    "影響は具体的に示されていません。",
    "内容は記載されておらず、回避策もありません。",
    "詳細は明記されておらず、不明です。",
  ])("分からない表現を落とす: %s", (phrase) => {
    expect(problemsOf(`${good}${phrase}`)).toContain("mentions-missing");
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
