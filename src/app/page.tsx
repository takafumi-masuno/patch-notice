import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-bold">{SITE_NAME}</h1>
      <p className="mt-4">{SITE_DESCRIPTION}</p>
      <p className="mt-2 text-slate-600">現在準備中です。</p>
    </main>
  );
}
