import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createFetcher, type HttpCache } from "./fetcher.ts";
import { runPipeline } from "./run.ts";
import { sources } from "./sources/index.ts";
import type { Item } from "./types.ts";

const DATA_DIR = process.argv[2] ?? "data";

interface State {
  http: HttpCache;
  kevCves: string[];
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

await mkdir(DATA_DIR, { recursive: true });
const previousItems = await readJson<Item[]>(join(DATA_DIR, "items.json"), []);
const state = await readJson<State>(join(DATA_DIR, "state.json"), {
  http: {},
  kevCves: [],
});

const { items, status, kevCves } = await runPipeline(
  sources,
  createFetcher(state.http),
  new Date(),
  { items: previousItems, kevCves: state.kevCves },
);

await writeJson(join(DATA_DIR, "items.json"), items);
await writeJson(join(DATA_DIR, "status.json"), status);
await writeJson(join(DATA_DIR, "state.json"), { http: state.http, kevCves });

for (const source of status.sources) {
  const state = source.ok ? (source.notModified ? "304" : "ok") : "NG";
  const note = source.error ? ` ${source.error}` : "";
  console.log(
    `${state.padEnd(3)} ${source.id.padEnd(14)} entries=${source.entries} items=${source.items}${note}`,
  );
}
const count = (urgency: Item["urgency"]) =>
  items.filter((item) => item.urgency === urgency).length;
console.log(
  `items=${items.length} action=${count("action")} review=${count("review")} normal=${count("normal")}`,
);

if (status.sources.every((source) => !source.ok)) {
  console.error("all sources failed");
  process.exitCode = 1;
}
