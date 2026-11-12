import { createRequire } from "node:module";
import path from "node:path";
import { Worker } from "node:worker_threads";

const TIMEOUT_MS = 5_000;

// Runs inside the worker. Templates come from people and models, so: every output is HTML-escaped, unknown
// variables and filters fail, only own properties are readable, lookups see only the template's own files,
// and parse/render/memory limits apply. A render that ignores the cooperative limits is killed by the timeout.
const WORKER_SOURCE = `
const { parentPort, workerData } = require("node:worker_threads");
const { Liquid } = require(workerData.liquidPath);
parentPort.on("message", async ({ id, files, entry, data }) => {
  try {
    const engine = new Liquid({
      templates: files,
      outputEscape: "escape",
      strictVariables: true,
      strictFilters: true,
      ownPropertyOnly: true,
      parseLimit: 1e6,
      renderLimit: 4000,
      memoryLimit: 64e6,
    });
    parentPort.postMessage({ id, html: await engine.renderFile(entry, data) });
  } catch (e) {
    parentPort.postMessage({ id, error: String((e && e.message) || e) });
  }
});
`;

type Pending = { resolve: (html: string) => void; reject: (e: Error) => void; timer: NodeJS.Timeout };
type State = { worker: Worker | null; source: string; pending: Map<number, Pending>; seq: number };

// On globalThis so dev hot reloads reuse one worker instead of leaking one per reload.
const g = globalThis as unknown as { __fenixTemplateWorker?: State };
const state: State = (g.__fenixTemplateWorker ??= { worker: null, source: "", pending: new Map(), seq: 0 });

function liquidPath(): string {
  return createRequire(path.join(process.cwd(), "package.json")).resolve("liquidjs");
}

function failAll(err: Error) {
  for (const p of state.pending.values()) {
    clearTimeout(p.timer);
    p.reject(err);
  }
  state.pending.clear();
}

function worker(): Worker {
  // A hot reload that changed the worker's code replaces the running worker.
  if (state.worker && state.source !== WORKER_SOURCE) {
    void state.worker.terminate();
    state.worker = null;
  }
  if (state.worker) return state.worker;
  state.source = WORKER_SOURCE;
  const w = new Worker(WORKER_SOURCE, { eval: true, workerData: { liquidPath: liquidPath() }, resourceLimits: { maxOldGenerationSizeMb: 256 } });
  w.unref();
  w.on("message", ({ id, html, error }: { id: number; html?: string; error?: string }) => {
    const p = state.pending.get(id);
    if (!p) return;
    clearTimeout(p.timer);
    state.pending.delete(id);
    if (error !== undefined) p.reject(new TemplateError(error));
    else p.resolve(html ?? "");
  });
  w.on("error", (e: Error) => {
    state.worker = null;
    failAll(new TemplateError(`template worker crashed: ${e.message}`));
  });
  w.on("exit", () => {
    if (state.worker === w) state.worker = null;
  });
  return (state.worker = w);
}

export class TemplateError extends Error {}

/** Renders `entry` from `files` (name → Liquid source) with `data`. Rejects with TemplateError on any template fault. */
export function renderLiquid(files: Record<string, string>, entry: string, data: unknown): Promise<string> {
  const w = worker();
  const id = ++state.seq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      state.pending.delete(id);
      // Killing the worker is the only way to stop a runaway render; the next call starts a fresh one.
      state.worker = null;
      void w.terminate();
      failAll(new TemplateError("template render timed out"));
      reject(new TemplateError(`template took longer than ${TIMEOUT_MS / 1000}s and was stopped`));
    }, TIMEOUT_MS);
    state.pending.set(id, { resolve, reject, timer });
    w.postMessage({ id, files, entry, data });
  });
}
