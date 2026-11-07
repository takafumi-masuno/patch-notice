import type { Audience, ProductId } from "./types.ts";

const RULES: ReadonlyArray<readonly [ProductId, RegExp]> = [
  ["chrome", /\bchrom(?:e|ium)\b/i],
  ["windows-office", /\bmicrosoft\b|\bwindows\b|\boffice\b|\bteams\b/i],
  ["apple", /\bapple\b|\bios\b|\bipados\b|\bmacos\b|\biphone\b/i],
  ["slack", /\bslack\b/i],
  ["nodejs", /\bnode\.?js\b/i],
  ["php", /\bphp\b/i],
  ["python", /\bpython\b/i],
  ["java", /\bjava\b|\bjdk\b/i],
  ["cisco", /\bcisco\b/i],
  ["fortinet", /\bfortinet\b|\bforti[a-z]+\b/i],
  ["paloalto", /\bpalo alto\b|\bpan-os\b/i],
  ["ivanti", /\bivanti\b/i],
  ["oracle", /\boracle\b/i],
  ["aws", /\baws\b|\bamazon web services\b/i],
  ["adobe", /\badobe\b/i],
  ["citrix", /\bcitrix\b|\bnetscaler\b/i],
  ["kubernetes", /\bkubernetes\b/i],
  ["wordpress", /\bwordpress\b/i],
];

export function detectProduct(text: string): ProductId {
  return RULES.find(([, pattern]) => pattern.test(text))?.[0] ?? "other";
}

/** 社員が自分の端末で更新できる製品 */
const EMPLOYEE_PRODUCTS = new Set<ProductId>([
  "windows-office",
  "apple",
  "chrome",
  "slack",
  "ca-incident",
]);

/** Microsoft でも、社員が操作しないサーバー製品 */
const SERVER_PRODUCT =
  /sharepoint|exchange|\bserver\b|\bsql\b|\bazure\b|active directory|hyper-v|\bdns\b|\.net/i;

/** 社員向けの周知文を出すかどうかは、ベンダーではなく製品で決める */
export function audienceFor(product: ProductId, title: string): Audience {
  if (!EMPLOYEE_PRODUCTS.has(product)) return "it";
  if (product === "windows-office" && SERVER_PRODUCT.test(title)) return "it";
  return "both";
}
