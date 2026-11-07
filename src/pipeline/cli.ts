import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { createFetcher, type HttpCache } from "./fetcher.ts";
import { runPipeline } from "./run.ts";
import { sources } from "./sources/index.ts";
import { createSummarizer } from "./summary/client.ts";
import { parseOverrides } from "./summary/overrides.ts";
import {
  attachSummaries,
  type SummaryStore,
  sourcesNeedingBody,
  summarizeItems,
} from "./summary/summarize.ts";
import type { Item } from "./types.ts";

const DATA_DIR = process.argv[2] ?? "data";
const OVERRIDES_PATH = fileURLToPath(
  new URL("./summary/overrides.json", import.meta.url),
);

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

const previousStore = await readJson<SummaryStore>(
  join(DATA_DIR, "summaries.json"),
  {},
);
const overrides = parseOverrides(await readJson(OVERRIDES_PATH, {}));
const now = new Date();
const aiEnabled = Boolean(process.env.ANTHROPIC_API_KEY);

const { items, status, kevCves, bodies } = await runPipeline(
  sources,
  createFetcher(state.http),
  now,
  { items: previousItems, kevCves: state.kevCves },
  aiEnabled
    ? sourcesNeedingBody(previousItems, previousStore, overrides)
    : new Set(),
);

let store = previousStore;
let fatalError: string | undefined;
if (aiEnabled) {
  const result = await summarizeItems({
    items,
    bodies,
    store,
    overrides,
    summarize: createSummarizer(new Anthropic()),
    now,
  });
  store = result.store;
  status.ai = result.status;
  fatalError = result.fatalError;
} else {
  console.log("ANTHROPIC_API_KEY is not set: skipped AI summaries");
}

const published = attachSummaries(items, store, overrides);
await writeJson(join(DATA_DIR, "items.json"), published);
await writeJson(join(DATA_DIR, "status.json"), status);
await writeJson(join(DATA_DIR, "state.json"), { http: state.http, kevCves });
await writeJson(join(DATA_DIR, "summaries.json"), store);

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
if (status.ai) console.log(`ai=${JSON.stringify(status.ai)}`);

const unusedOverrides = Object.keys(overrides).filter(
  (id) => !items.some((item) => item.id === id),
);
if (unusedOverrides.length > 0) {
  console.log(`unused overrides: ${unusedOverrides.join(" ")}`);
}

if (status.sources.every((source) => !source.ok)) {
  console.error("all sources failed");
  process.exitCode = 1;
}
if (fatalError) {
  // データは保存した上で、実行を失敗として知らせる
  console.error(`AI summaries stopped: ${fatalError}`);
  process.exitCode = 1;
}
