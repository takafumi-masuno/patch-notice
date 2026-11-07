# Patch Notice

情シスの周知に使える、脆弱性とアップデートの情報サイトです。現在は開発中です。

## 画面

| URL | 内容 |
|---|---|
| `/` | 直近7日の要対応と要確認、絞り込み付きの全件一覧 |
| `/items/[id]/` | 悪用の状況、要約、情シスの対応、社員向けの周知文、出典 |
| `/certificates/` | 証明書の期限、認証局の事案 |
| `/feed.xml` | 全件の RSS（新しい順に50件） |
| `/feed-action.xml` | 要対応の RSS（新しい順に50件） |

```sh
pnpm run pipeline  # data/ を作る
pnpm dev           # http://localhost:3000/patch-notice/
```

ビルド時に `data/` を読みます。`data/` がなければ、全ページを準備中の表示にします。別の場所を読むときは `PATCH_NOTICE_DATA_DIR` を指定します。

## テスト

```sh
pnpm test                               # ユニットテスト
pnpm exec playwright install chromium   # 初回のみ
pnpm e2e:build                          # E2E 用にデータあり、データなしの2種類を書き出す
pnpm e2e                                # 画面とアクセシビリティのテスト
```

E2E のデータは `e2e/fixtures/` の自作データです。実際の記事は使いません。

## 証明書の期限

`src/content/certificates.json` に手で登録します。公式情報を見て日付を確認し、`sourceUrl` と確認日の `checkedAt` を入れます。形式の誤りや `https` でないリンクは、ビルドで止まります。

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
| `summaries.json` | AI 要約の保存先。本文は含みません |

緊急度は `src/pipeline/classify.ts` の規則で判定します。AI には判定させません。

## AI 要約

CISA KEV と Cisco の項目を、Claude Sonnet 5.5 で日本語に要約します。`.env` に `ANTHROPIC_API_KEY` を入れると有効になり、なければ要約せずに処理を続けます。

- **AI が書くのは事実の要約だけです。** 悪用の状況、情シスの対応、社員向けの周知文は、コードの判定と定型文（`src/lib/notice.ts`）で作ります。
- **要約は `src/pipeline/summary/check.ts` で検証します。** CVE、バージョン、英単語が元データと一致しない要約、助言や悪用の断定を含む要約は公開しません。
- **失敗しても公開は止まりません。** 拒否、検証落ち、API の失敗は定型文で公開し、`status.json` の `ai` に件数を記録します。認証の失敗はデータを保存した上で終了コード 1 にします。
- **費用には上限があります。** 1回の実行で $1.5、200件までです。本文が変わった項目だけ作り直します。プロンプトを変えても既存の要約は作り直さないので、作り直すときは `summaries.json` の該当項目を消します。

検証は機械的なものなので、製品の取り違えや書かれていない推測は検出できません。要約には AI 生成と分かる表示と公式へのリンクを付けます。

### 要約の手動差し替え

`src/pipeline/summary/overrides.json` に項目の `id` を指定します。`summary` を `null` にすると要約を出さず、定型文で公開します。

```json
{
  "0123456789abcdef": { "summary": "修正後の要約", "reason": "修正の理由" }
}
```
