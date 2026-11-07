# Patch Notice

情シスの周知に使える、脆弱性とアップデートの情報サイトです。現在は開発中です。

## データ取得

```sh
pnpm run pipeline
```

公式の情報源から取得し、`data/` に JSON を保存します。`data/` は Git の管理対象外です。

| ファイル | 内容 |
|---|---|
| `items.json` | 公開用の項目（直近90日分）。本文は含みません |
| `status.json` | 情報源ごとの取得結果 |
| `state.json` | 次回の差分取得に使う値と KEV の CVE 一覧 |

緊急度は `src/pipeline/classify.ts` の規則で判定します。AI には判定させません。
