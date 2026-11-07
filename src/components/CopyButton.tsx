"use client";

import { useState } from "react";

type CopyState = "idle" | "copied" | "failed";

const MESSAGES: Record<Exclude<CopyState, "idle">, string> = {
  copied: "コピーしました",
  failed: "コピーできませんでした。文章を選択してコピーしてください",
};

export function CopyButton({ label, text }: { label: string; text: string }) {
  const [state, setState] = useState<CopyState>("idle");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      // 権限がない環境では失敗する。成功したように見せず、手で選ぶよう案内する
      setState("failed");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        className="rounded border border-accent bg-surface px-3 py-1.5 text-sm font-medium text-accent hover:bg-canvas"
        type="button"
        onClick={copy}
      >
        {label}
      </button>
      <span aria-live="polite" className="text-sm text-muted">
        {state === "idle" ? "" : MESSAGES[state]}
      </span>
    </div>
  );
}
