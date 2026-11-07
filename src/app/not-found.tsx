import Link from "next/link";

export default function NotFound() {
  return (
    <div className="rounded-lg border border-line bg-surface p-8">
      <h1 className="text-2xl font-bold">ページが見つかりません</h1>
      <p className="mt-4">
        掲載から90日を過ぎた情報は、一覧から外れてページもなくなります。
      </p>
      <p className="mt-2">
        <Link className="text-accent underline" href="/" prefetch={false}>
          一覧へ戻る
        </Link>
      </p>
    </div>
  );
}
