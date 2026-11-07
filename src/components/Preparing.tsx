import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

/** データがない間に出す画面。古い情報や空の一覧を公開しないために使う */
export function Preparing() {
  return (
    <div className="rounded-lg border border-line bg-surface p-8">
      <h1 className="text-2xl font-bold">{SITE_NAME}</h1>
      <p className="mt-4">{SITE_DESCRIPTION}</p>
      <p className="mt-2 text-muted">現在準備中です。</p>
    </div>
  );
}
