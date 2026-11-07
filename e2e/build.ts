/** E2E 用に、データありとデータなしの2種類を書き出す */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const OUTPUT = ".e2e";

function build(name: string, dataDir: string): void {
  const result = spawnSync("pnpm exec next build", {
    shell: true,
    stdio: "inherit",
    env: { ...process.env, PATCH_NOTICE_DATA_DIR: dataDir },
  });
  if (result.status !== 0) throw new Error(`${name} のビルドに失敗しました`);
  renameSync("out", path.join(OUTPUT, name));
}

rmSync(OUTPUT, { recursive: true, force: true });
mkdirSync(OUTPUT);
const empty = mkdtempSync(path.join(tmpdir(), "patch-notice-empty-"));
try {
  build("with-data", path.resolve("e2e/fixtures"));
  build("no-data", empty);
} finally {
  rmSync(empty, { recursive: true });
}
