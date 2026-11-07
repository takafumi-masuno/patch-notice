import {
  EXPLOITATION_LABELS,
  type ExploitationStatus,
  URGENCY_LABELS,
} from "@/lib/notice";
import type { Urgency } from "@/pipeline/types";

const URGENCY_STYLES: Record<Urgency, string> = {
  action: "bg-action text-white",
  review: "bg-review-soft text-review ring-1 ring-review/40",
  normal: "bg-canvas text-muted ring-1 ring-line",
};

/** 色だけに頼らないよう、必ず文字で緊急度を示す */
export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-bold whitespace-nowrap ${URGENCY_STYLES[urgency]}`}
    >
      {URGENCY_LABELS[urgency]}
    </span>
  );
}

const EXPLOITATION_STYLES: Record<ExploitationStatus, string> = {
  confirmed: "font-bold text-action",
  related: "font-bold text-review",
  none: "text-muted",
};

export function ExploitationText({ status }: { status: ExploitationStatus }) {
  return (
    <span className={`text-sm ${EXPLOITATION_STYLES[status]}`}>
      {EXPLOITATION_LABELS[status]}
    </span>
  );
}
