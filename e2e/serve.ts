/** 書き出した静的サイトを GitHub Pages と同じパスで配信する。E2E 専用 */
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { BASE_PATH } from "../src/lib/site.ts";

const [dir, port] = process.argv.slice(2);
if (!dir || !port) throw new Error("使い方: serve.ts <dir> <port>");
const root = path.resolve(dir);

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
};

function resolve(pathname: string): string | undefined {
  const relative = decodeURIComponent(pathname.slice(BASE_PATH.length));
  const candidates = [relative, path.join(relative, "index.html")];
  for (const candidate of candidates) {
    const file = path.join(root, candidate);
    if (!file.startsWith(root)) continue;
    if (statSync(file, { throwIfNoEntry: false })?.isFile()) return file;
  }
  return undefined;
}

createServer((request, response) => {
  const { pathname } = new URL(request.url ?? "/", "http://localhost");
  if (pathname === BASE_PATH) {
    response.writeHead(301, { Location: `${BASE_PATH}/` }).end();
    return;
  }
  const file = pathname.startsWith(`${BASE_PATH}/`) && resolve(pathname);
  const target = file || path.join(root, "404.html");
  const type = TYPES[path.extname(target)] ?? "application/octet-stream";
  response.writeHead(file ? 200 : 404, { "Content-Type": type });
  createReadStream(target).pipe(response);
}).listen(Number(port), "127.0.0.1");
