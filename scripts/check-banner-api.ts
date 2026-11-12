// Integration check for banner generation against a local OpenAI stub: never calls OpenAI, never spends money.
// Needs a production build (`pnpm exec next build`). Starts its own servers on 3027/3028 over a copy of the demo person.
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { promises as fs } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import YAML from "yaml";

const WORK = path.resolve(".scratch/check-banner-api");
const DATA = path.join(WORK, "data");
const PERSON = "demo";
const FAKE_KEY = "sk-test-not-a-real-key";
const PNG_1PX = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

type Seen = { auth?: string; body: Record<string, unknown> };
const seen: Seen[] = [];
let fail = false;
const stub = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    seen.push({ auth: req.headers.authorization, body: JSON.parse(raw || "{}") });
    // The delay keeps the first request in flight so a concurrent second one meets the in-flight guard.
    setTimeout(() => {
      res.setHeader("content-type", "application/json");
      if (fail) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: { message: "stub refused" } }));
      } else res.end(JSON.stringify({ data: [{ b64_json: PNG_1PX }] }));
    }, 1000);
  });
});

const servers: ChildProcess[] = [];
async function startApp(port: number, env: Record<string, string>) {
  const child = spawn("pnpm", ["exec", "next", "start", "-p", String(port)], {
    env: { ...process.env, OPENAI_API_KEY: "", ...env, FENIX_DATA_DIR: DATA, APP_URL: `http://localhost:${port}` },
    stdio: "ignore",
    detached: true,
  });
  servers.push(child);
  for (let i = 0; i < 60; i++) {
    const up = await fetch(`http://localhost:${port}/api/p/${PERSON}/banner`).then((r) => r.ok, () => false);
    if (up) return `http://localhost:${port}/api/p/${PERSON}/banner`;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server on ${port} did not start`);
}

const bgDir = path.join(DATA, PERSON, "linkedin", "backgrounds");
const pngCount = async () => (await fs.readdir(bgDir).catch(() => [] as string[])).filter((f) => f.endsWith(".png")).length;
const yamlEntries = async () => {
  const text = await fs.readFile(path.join(DATA, PERSON, "linkedin", "banner.yaml"), "utf8").catch(() => "");
  return (YAML.parse(text)?.backgrounds ?? []) as { file: string }[];
};

let passed = 0;
const ok = (name: string) => console.log(`ok ${++passed} - ${name}`);

try {
  await fs.rm(WORK, { recursive: true, force: true });
  await fs.cp("examples/demo", path.join(DATA, PERSON), { recursive: true });
  await new Promise<void>((r) => stub.listen(0, "127.0.0.1", r));
  const stubUrl = `http://127.0.0.1:${(stub.address() as AddressInfo).port}/v1`;

  const api = await startApp(3027, { OPENAI_API_KEY: FAKE_KEY, OPENAI_BASE_URL: stubUrl });

  // 1. One click: one request to OpenAI, one file, one YAML entry, selected.
  const r1 = await fetch(`${api}/generate`, { method: "POST" });
  const b1 = await r1.json();
  assert.equal(r1.status, 200, JSON.stringify(b1));
  assert.equal(seen.length, 1);
  assert.equal(seen[0].auth, `Bearer ${FAKE_KEY}`);
  assert.deepEqual(
    { model: seen[0].body.model, size: seen[0].body.size, quality: seen[0].body.quality, n: seen[0].body.n, output_format: seen[0].body.output_format },
    { model: "gpt-image-2", size: "1536x1024", quality: "medium", n: 1, output_format: "png" },
  );
  assert.ok(!("response_format" in seen[0].body));
  assert.equal(await pngCount(), 1);
  const entries = await yamlEntries();
  assert.equal(entries.length, 1);
  assert.equal(b1.banner.background, entries[0].file);
  ok("one generate = one OpenAI request, one stored file, one entry, selected");

  // 2. Two at once: one runs, the other is refused before it reaches OpenAI.
  const both = await Promise.all([fetch(`${api}/generate`, { method: "POST" }), fetch(`${api}/generate`, { method: "POST" })]);
  assert.deepEqual(both.map((r) => r.status).sort(), [200, 409]);
  assert.equal(seen.length, 2);
  assert.equal(await pngCount(), 2);
  ok("concurrent generates: one 200, one 409, one OpenAI request");

  // 3. An OpenAI error writes nothing.
  fail = true;
  const r3 = await fetch(`${api}/generate`, { method: "POST" });
  assert.equal(r3.status, 502);
  assert.match((await r3.json()).error, /stub refused/);
  assert.equal(await pngCount(), 2);
  assert.equal((await yamlEntries()).length, 2);
  ok("an OpenAI error answers 502 and stores nothing");

  // 4. Without a key: 400 with the instruction, and the page data says so.
  const noKey = await startApp(3028, { OPENAI_BASE_URL: stubUrl });
  const r4 = await fetch(`${noKey}/generate`, { method: "POST" });
  assert.equal(r4.status, 400);
  assert.equal((await r4.json()).error, "OPENAI_API_KEY is not set: add it to .env to generate backgrounds.");
  assert.equal((await (await fetch(noKey)).json()).hasKey, false);
  assert.equal(seen.length, 3);
  ok("no key: 400 with the .env instruction, hasKey false, no request sent");
} finally {
  for (const s of servers) if (s.pid) try { process.kill(-s.pid); } catch {}
  stub.close();
  await fs.rm(WORK, { recursive: true, force: true });
}
console.log(`check:banner-api: ${passed} passed`);
