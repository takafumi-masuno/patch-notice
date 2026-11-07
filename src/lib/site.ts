export const SITE_NAME = "Patch Notice";
export const SITE_DESCRIPTION =
  "情シスの周知に使える、脆弱性とアップデートの情報サイトです。";
export const SITE_ORIGIN = "https://takafumi-masuno.github.io";
export const BASE_PATH = "/patch-notice";

/** RSS や OGP など、完全な URL が必要な場所で使う。`path` は `/` から始める。 */
export function absoluteUrl(path: string): string {
  if (!path.startsWith("/")) {
    throw new Error(`path must start with "/": ${path}`);
  }
  return `${SITE_ORIGIN}${BASE_PATH}${path}`;
}
