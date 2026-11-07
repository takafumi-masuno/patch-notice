import {
  RELATED_KEV_REASON,
  WINDOWS_MONTHLY_SOURCE,
} from "../pipeline/reasons.ts";
import type { Item, ProductId, Urgency } from "../pipeline/types.ts";
import { isHttpsUrl } from "./site.ts";

export const PRODUCT_NAMES: Record<ProductId, string> = {
  "windows-office": "Windows / Microsoft 製品",
  apple: "iPhone / Mac",
  chrome: "Google Chrome",
  slack: "Slack",
  nodejs: "Node.js",
  php: "PHP",
  python: "Python",
  java: "Java",
  cisco: "Cisco 製品",
  fortinet: "Fortinet 製品",
  paloalto: "Palo Alto Networks 製品",
  ivanti: "Ivanti 製品",
  oracle: "Oracle 製品",
  aws: "AWS",
  adobe: "Adobe 製品",
  citrix: "Citrix 製品",
  kubernetes: "Kubernetes",
  wordpress: "WordPress",
  "ca-incident": "認証局",
  other: "対象の製品",
};

export const URGENCY_LABELS: Record<Urgency, string> = {
  action: "要対応",
  review: "要確認",
  normal: "通常",
};

/** 配信を管理している場合に、情シスが見る場所 */
const IT_ROLLOUT: Partial<Record<ProductId, string>> = {
  "windows-office":
    "WSUS や Intune で配信している場合は、配信と適用の状況を確認してください。",
  apple: "MDM で管理している場合は、配信と適用の状況を確認してください。",
  chrome:
    "ポリシーで更新を管理している場合は、配信と適用の状況を確認してください。",
  slack: "配布を管理している場合は、配布するバージョンを確認してください。",
};

/** 社員が更新する手順。製品の操作だけを書き、脆弱性の内容は書かない */
const EMPLOYEE_STEPS: Partial<Record<ProductId, string>> = {
  "windows-office": [
    "Windows: 「設定」>「Windows Update」>「更新プログラムのチェック」を開き、更新して再起動してください。",
    "Office: 任意の Office アプリで「ファイル」>「アカウント」>「更新オプション」>「今すぐ更新」を選んでください。",
  ].join("\n"),
  apple: [
    "iPhone: 「設定」>「一般」>「ソフトウェアアップデート」を開き、更新してください。",
    "Mac: 「システム設定」>「一般」>「ソフトウェアアップデート」を開き、更新してください。",
  ].join("\n"),
  chrome:
    "Chrome のメニューから「ヘルプ」>「Google Chrome について」を開き、更新後に「再起動」を押してください。",
  slack: "Slack を再起動し、最新版になっていることを確認してください。",
};

const EMPLOYEE_LEAD: Record<Urgency, string> = {
  action: "セキュリティ上の重要な更新です。できるだけ早く更新してください。",
  review: "セキュリティ更新が公開されています。次の手順で更新してください。",
  normal: "更新が公開されています。作業の区切りで更新してください。",
};

const MANAGED_NOTE =
  "会社の管理で更新が配信される端末は、情シスの案内に従ってください。";

/** AI の文章を出す場所では、必ずこの表示を付ける */
export const AI_SUMMARY_LABEL = "AI 要約";

export interface EmployeeNotice {
  subject: string;
  body: string;
}

export interface Notice {
  summary: string;
  /** facts はコードで組み立てた文で、AI を使っていない */
  summaryOrigin: "ai" | "manual" | "facts";
  /** AI 生成の表示に使う、実際に応答したモデル */
  summaryModel?: string;
  itAction: string;
  /** 情シス向けのみの項目には付かない */
  employee?: EmployeeNotice;
}

/** confirmed: 項目自体の悪用、related: 関連する CVE の悪用、none: 確認した情報がない */
export type ExploitationStatus = "confirmed" | "related" | "none";

/** none は「悪用されていない」という意味ではないので、そう読める語を使わない */
export const EXPLOITATION_LABELS: Record<ExploitationStatus, string> = {
  confirmed: "悪用確認",
  related: "関連する CVE の悪用確認",
  none: "確認情報なし",
};

export const EXPLOITATION_DETAILS: Record<ExploitationStatus, string> = {
  confirmed: "悪用が確認されています。",
  related:
    "関連する CVE の悪用が確認されています。この項目のすべての CVE が悪用されているとは限りません。",
  none: "悪用を確認した情報はありません。悪用がないことを示すものではありません。",
};

/** 関連する CVE の一部だけが悪用されている場合があるので、項目全体の断定と分ける */
export function exploitationStatus(item: Item): ExploitationStatus {
  if (!item.exploited) return "none";
  return item.urgencyReasons.includes(RELATED_KEV_REASON)
    ? "related"
    : "confirmed";
}

function exploitationNote(item: Item): string {
  return exploitationStatus(item) === "related"
    ? "関連する CVE の悪用が確認されています。"
    : "悪用が確認されています。";
}

/** 画面に出す製品名。other は文中向けの語なので、一覧では別の語にする */
export function productLabel(product: ProductId): string {
  return product === "other" ? "その他" : PRODUCT_NAMES[product];
}

/** AI の要約がない項目に出す文。公開データの事実だけで組み立てる */
function factsSummary(item: Item): string {
  if (item.source === WINDOWS_MONTHLY_SOURCE) {
    return "毎月第2火曜（米国時間）の定例の更新日です。更新の内容と重要度は公式情報で確認してください。";
  }
  const parts = [`${PRODUCT_NAMES[item.product]}に関する公開情報です。`];
  if (item.version) parts.push(`バージョンは ${item.version} です。`);
  if (item.cveCount > 0) parts.push(`CVE は ${item.cveCount} 件です。`);
  if (item.exploited) parts.push(exploitationNote(item));
  if (item.vendorSeverity) {
    parts.push(`メーカーの評価は ${item.vendorSeverity} です。`);
  }
  return parts.join("");
}

function itAction(item: Item): string {
  const rollout = IT_ROLLOUT[item.product];
  const lines = [itLead(item), ...(rollout ? [rollout] : [])];
  return lines.join("\n");
}

function itLead(item: Item): string {
  if (item.product === "ca-incident") {
    return "対象の認証局の証明書を自社で使っていないか確認し、ブラウザや OS の更新情報を追ってください。";
  }
  if (item.exploited) {
    return `${exploitationNote(item)}自社での利用を確認し、公式情報で修正版と回避策を確認して、優先して対応してください。`;
  }
  // 要対応の根拠のうち、悪用以外は国内機関の注意喚起だけ
  if (item.urgency === "action") {
    return "国内機関が注意喚起を出しています。自社での利用を確認し、公式情報に沿って対応してください。";
  }
  if (item.urgency === "review") {
    return "自社での利用と影響を確認し、必要なら対応の予定を立ててください。";
  }
  return "自社で利用している場合は、通常の更新計画に含めてください。";
}

function employeeNotice(item: Item): EmployeeNotice | undefined {
  if (item.audience !== "both") return undefined;
  if (item.product === "ca-incident") {
    return {
      subject: "【お知らせ】証明書に関する情報",
      body: "認証局に関する問題が公表されました。現時点で皆さんの操作は必要ありません。情シスから案内があった場合は、その内容に従ってください。",
    };
  }
  const steps = EMPLOYEE_STEPS[item.product];
  if (!steps) return undefined;
  const lines = [EMPLOYEE_LEAD[item.urgency]];
  if (item.exploited) lines.push(exploitationNote(item));
  lines.push(steps);
  if (item.version) {
    lines.push(`更新後のバージョンが ${item.version} 以上か確認してください。`);
  }
  lines.push(MANAGED_NOTE);
  return {
    subject: `【${URGENCY_LABELS[item.urgency]}】${PRODUCT_NAMES[item.product]}の更新のお願い`,
    body: lines.join("\n"),
  };
}

/** 情シスがチャットなどへ貼る文。AI の要約は含めない */
export function itCopyText(item: Item, notice: Notice): string {
  const lines = [item.title, notice.itAction];
  if (isHttpsUrl(item.url)) lines.push(`公式情報: ${item.url}`);
  return lines.join("\n");
}

/** 社員へ送る文。AI の要約は含めない */
export function employeeCopyText(employee: EmployeeNotice): string {
  return `件名: ${employee.subject}\n\n${employee.body}`;
}

/**
 * 項目から周知の材料を組み立てる。
 * 公開データから都度作るので、定型文を直すと過去の項目にも反映される。
 * 情シスの対応と社員向けの文には AI の文章を混ぜない。
 */
export function noticeFor(item: Item): Notice {
  const employee = employeeNotice(item);
  return {
    summary: item.summary?.text ?? factsSummary(item),
    summaryOrigin: item.summary?.origin ?? "facts",
    ...(item.summary?.model ? { summaryModel: item.summary.model } : {}),
    itAction: itAction(item),
    ...(employee ? { employee } : {}),
  };
}
