import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  absoluteUrl,
  BASE_PATH,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_ORIGIN,
} from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  // 公開準備が整うまで検索結果に載せない
  robots: { index: false, follow: false },
  alternates: {
    types: {
      "application/rss+xml": [
        { url: absoluteUrl("/feed.xml"), title: `${SITE_NAME} 全件` },
        {
          url: absoluteUrl("/feed-action.xml"),
          title: `${SITE_NAME} 要対応`,
        },
      ],
    },
  },
};

/*
 * 内部リンクの先読みは使わない。静的書き出しでは先読みのファイルのパスが
 * 実際の出力と合わず、404 になる。移動そのものは先読みがなくても動く。
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body className="font-sans">
        <a
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:bg-surface focus:px-3 focus:py-2"
          href="#main"
        >
          本文へ移動
        </a>
        <header className="bg-ink text-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-3">
            <Link className="text-lg font-bold" href="/" prefetch={false}>
              {SITE_NAME}
            </Link>
            <nav aria-label="サイト内">
              <ul className="flex gap-4 text-sm">
                <li>
                  <Link className="hover:underline" href="/" prefetch={false}>
                    一覧
                  </Link>
                </li>
                <li>
                  <Link
                    className="hover:underline"
                    href="/certificates/"
                    prefetch={false}
                  >
                    証明書
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6" id="main">
          {children}
        </main>
        <footer className="border-t border-line text-sm text-muted">
          <div className="mx-auto max-w-6xl space-y-2 px-4 py-6">
            <p>
              公式の公開情報をもとに自動で作成しています。対応の判断は、各項目の公式情報で確認してください。
            </p>
            <p>
              RSS:{" "}
              <a className="underline" href={`${BASE_PATH}/feed.xml`}>
                全件
              </a>
              {" / "}
              <a className="underline" href={`${BASE_PATH}/feed-action.xml`}>
                要対応のみ
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
