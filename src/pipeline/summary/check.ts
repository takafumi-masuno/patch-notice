import { extractCves } from "../text.ts";

interface CheckInput {
  title: string;
  body: string;
}

const MIN_LENGTH = 20;
const MAX_LENGTH = 500;
const VERSION = /\d+(?:\.\d+)+/g;
const CVE_LIKE = /CVE[^\d\n]{0,3}\d{4}[^\d\n]{1,2}\d+/gi;
const CVE_EXACT = /^CVE-\d{4}-\d{4,}$/i;
// 「Windows」や「OS」のような短い語は一般語が多いので、3文字以上を比べる
const LATIN_WORD = /[A-Za-z][A-Za-z0-9+#_-]{2,}/g;
const ADVICE =
  /ください|すべき|しましょう|必要があります|を推奨|を検討|を制限|を監視|を確認して/;
const MENTIONS_MISSING =
  /記載がありません|(?:記載|明記|示)されて(?:いません|おらず)|確認できません/;
const SOURCE_LEAK =
  /<\/?source>|(?<!open[ -])\bsource\b(?! code)|(?<![ァ-ヶー])ソース(?!コード)|情報源|提供された情報/i;
// 悪用の状況はコードの判定だけで示す。項目単位の判定を AI が文にすると、
// CVE が複数ある項目で全件が悪用されているように読めてしまう
const EXPLOIT_CLAIM = /悪用.{0,8}確認|悪用されて[いお]|悪用の有無|悪用の報告/;

function matches(text: string, pattern: RegExp): string[] {
  return text.match(pattern) ?? [];
}

/** 元データに正式名称があるときだけ通す略語。製品名の取り違えを通さないよう、一覧で限定する */
const ABBREVIATIONS: Readonly<Record<string, RegExp>> = {
  dos: /denial[- ]of[- ]service/i,
  ssrf: /server[- ]side request forgery/i,
  rce: /remote code execution/i,
  xss: /cross[- ]site scripting/i,
  csrf: /cross[- ]site request forgery/i,
  mfa: /multi[- ]factor authentication/i,
  gre: /generic routing encapsulation/i,
};

function isAbbreviationIn(word: string, source: string): boolean {
  return ABBREVIATIONS[word.toLowerCase()]?.test(source) ?? false;
}

/**
 * 要約を公開してよいか機械で調べ、問題の一覧を返す。
 * 空でなければ公開せず、定型文を使う。
 * 製品の取り違えのような誤りは検出できないので、AI 生成の表示と公式リンクを併せて出す。
 */
export function checkSummary(input: CheckInput, summary: string): string[] {
  const source = `${input.title}\n${input.body}`;
  const lowerSource = source.toLowerCase();
  const problems: string[] = [];

  if (summary.length < MIN_LENGTH) problems.push("too-short");
  if (summary.length > MAX_LENGTH) problems.push("too-long");
  if (!/[ぁ-ん]/.test(summary)) problems.push("not-japanese");

  const sourceCves = new Set(extractCves(source));
  for (const cve of extractCves(summary)) {
    if (!sourceCves.has(cve)) problems.push(`cve:${cve}`);
  }
  for (const cve of matches(summary, CVE_LIKE)) {
    if (!CVE_EXACT.test(cve)) problems.push(`cve-malformed:${cve}`);
  }

  // 部分一致だと 1.2 が 11.2.3 に一致してしまうので、番号の単位で比べる
  const sourceVersions = new Set(matches(source, VERSION));
  for (const version of matches(summary, VERSION)) {
    if (!sourceVersions.has(version)) problems.push(`version:${version}`);
  }

  for (const word of matches(summary, LATIN_WORD)) {
    if (
      !lowerSource.includes(word.toLowerCase()) &&
      !isAbbreviationIn(word, source)
    ) {
      problems.push(`word:${word}`);
    }
  }

  if (/https?:\/\/|www\./i.test(summary)) problems.push("url");
  if (SOURCE_LEAK.test(summary)) problems.push("source-leak");
  if (MENTIONS_MISSING.test(summary)) problems.push("mentions-missing");
  if (ADVICE.test(summary)) problems.push("advice");
  if (EXPLOIT_CLAIM.test(summary)) problems.push("exploit-claim");
  return problems;
}
