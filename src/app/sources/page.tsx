import type { Metadata } from "next";
import {
  SOURCE_CREDITS,
  type SourceCredit,
  UNFETCHED_PRODUCTS,
} from "@/lib/credits";

export const metadata: Metadata = { title: "情報源" };

function ExternalLink(props: { href: string; children: string }) {
  return (
    <a
      className="text-accent underline underline-offset-2"
      href={props.href}
      rel="noopener noreferrer"
      target="_blank"
    >
      {props.children}（別タブ）
    </a>
  );
}

function CreditCard({ credit }: { credit: SourceCredit }) {
  return (
    <li className="rounded-lg border border-line bg-surface p-3">
      <h3 className="font-medium">
        <ExternalLink href={credit.url}>{credit.name}</ExternalLink>
      </h3>
      <dl className="mt-1 space-y-1 text-sm">
        <div>
          <dt className="inline text-muted">載せる内容: </dt>
          <dd className="inline">{credit.content}</dd>
        </div>
        <div>
          <dt className="inline text-muted">帰属: </dt>
          <dd className="inline">{credit.attribution}</dd>
        </div>
        {credit.licenseUrl && credit.licenseName && (
          <div>
            <dt className="inline text-muted">ライセンス: </dt>
            <dd className="inline">
              <ExternalLink href={credit.licenseUrl}>
                {credit.licenseName}
              </ExternalLink>
            </dd>
          </div>
        )}
      </dl>
    </li>
  );
}

export default function Sources() {
  return (
    <>
      <h1 className="text-2xl font-bold">情報源</h1>
      <p className="mt-2">
        各項目には情報源の名前と公式情報へのリンクを付けています。各社や各機関とは関係のない、個人が運営するサイトです。製品名やロゴは各社の商標です。
      </p>

      <section aria-labelledby="fetched" className="mt-8">
        <h2 className="text-lg font-bold" id="fetched">
          利用している情報源
        </h2>
        <ul className="mt-3 space-y-2">
          {Object.entries(SOURCE_CREDITS).map(([id, credit]) => (
            <CreditCard credit={credit} key={id} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="unfetched" className="mt-8">
        <h2 className="text-lg font-bold" id="unfetched">
          自動で取得していない製品
        </h2>
        <p className="mt-2">
          次の製品は、利用条件のため公式情報を自動で取得していません。CISA
          のカタログに載った脆弱性は一覧に出ますが、それ以外の更新は一覧に出ません。公式情報を確認してください。
        </p>
        <ul className="mt-3 space-y-1">
          {UNFETCHED_PRODUCTS.map((link) => (
            <li key={link.url}>
              {link.product}:{" "}
              <ExternalLink href={link.url}>{link.name}</ExternalLink>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
