const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    const lower = String(entity).toLowerCase();
    if (lower.startsWith("#")) {
      const code = lower.startsWith("#x")
        ? Number.parseInt(lower.slice(2), 16)
        : Number.parseInt(lower.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[lower] ?? match;
  });
}

/** フィードの本文を判定用の平文にする。出力を HTML として表示してはいけない。 */
export function htmlToText(raw: string): string {
  const withoutCdata = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  // フィードの HTML は二重にエスケープされていることがある
  const decoded = decodeEntities(decodeEntities(withoutCdata));
  return decodeEntities(
    decoded
      .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]*>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

export function extractCves(text: string): string[] {
  const found = text.match(/CVE-\d{4}-\d{4,}/gi) ?? [];
  return [...new Set(found.map((cve) => cve.toUpperCase()))].sort();
}

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|(?<=。)/);
}

const EXPLOITED =
  /exists? in the wild|exploited in the wild|actively exploited|active exploitation|being exploited|悪用.{0,8}確認/i;
// 否定文に加えて、「悪用の証拠が出たら」のような仮定の文も悪用の明記として数えない
const NEGATED =
  /\bnot\b|\bno evidence\b|\bunaware\b|\bshould\b|\bif\b|ていません|ありません/i;

/** 本文に悪用の明記があるか。否定文は数えない。 */
export function mentionsExploitation(text: string): boolean {
  return sentences(text).some(
    (sentence) => EXPLOITED.test(sentence) && !NEGATED.test(sentence),
  );
}

const CA_TERMS =
  /certificate authorit|intermediate (?:ca|certificate)|root (?:ca|certificate)|認証局|中間\s?CA|ルート証明書/i;
const CA_INCIDENT = /compromis|distrust|key disclosure|危殆化|不信頼/i;

/** 認証局の事案らしい語句が同じ文にあるか。自動で要対応にはせず、要確認の根拠にする。 */
export function isCaIncident(text: string): boolean {
  return sentences(text).some(
    (sentence) => CA_TERMS.test(sentence) && CA_INCIDENT.test(sentence),
  );
}

/** 画面のリンクに使える URL にする。http は https に上げ、それ以外のスキームは捨てる */
export function safeUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol === "http:") url.protocol = "https:";
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function toIsoDate(value: string): string | null {
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}
