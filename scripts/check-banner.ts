// Pure checks for the LinkedIn banner (no server, no OpenAI): escaping, one layout for preview and export, PNG size.
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { bannerHtml } from "../lib/banner/layout";
import { stripColorChunks } from "../lib/banner/png";
import { renderBannerPng } from "../lib/banner/render";
import { getBrowser } from "../lib/pdf/render";

const OUT = path.resolve(".scratch/check-banner");
await fs.mkdir(OUT, { recursive: true });

const base = { valueLine: "I build products,\nand AI workflows.", roleLine: "Product Leader · Growth", textScale: 1, textCenterY: 0.42, cropY: 0.5 };
const font = await fs.readFile("public/fonts/OpenSans.ttf");
const fontData = `data:font/ttf;base64,${font.toString("base64")}`;
const bg = await fs.readFile(".scratch/linkedin-banner/banner-bg.png").catch(() => null);
let passed = 0;
const ok = (name: string) => console.log(`ok ${++passed} - ${name}`);

// 1. Text is escaped, never markup.
const hostile = bannerHtml({ ...base, valueLine: "<b>x</b> & more", roleLine: `"quoted" 'single'` }, { fontSrc: "/f.ttf", backgroundSrc: null });
assert.ok(hostile.includes("&lt;b&gt;x&lt;/b&gt; &amp; more"));
assert.ok(!hostile.includes("<b>x</b>"));
assert.ok(hostile.includes("&quot;quoted&quot; &#39;single&#39;"));
ok("text is HTML-escaped");

// 2. Preview (URLs) and export (data: URIs) differ only in the asset sources.
const preview = bannerHtml(base, { fontSrc: "/fonts/OpenSans.ttf", backgroundSrc: "/api/p/x/banner/backgrounds/a.png" });
const exported = bannerHtml(base, { fontSrc: fontData, backgroundSrc: "data:image/png;base64,AAAA" });
const norm = (h: string, f: string, b: string) => h.replace(f, "FONT").replace(b, "BG");
assert.equal(norm(preview, "/fonts/OpenSans.ttf", "/api/p/x/banner/backgrounds/a.png"), norm(exported, fontData, "data:image/png;base64,AAAA"));
ok("preview and export share one layout");

// 3. An empty value line renders the role line alone.
const roleOnly = bannerHtml({ ...base, valueLine: "  " }, { fontSrc: "/f.ttf", backgroundSrc: null });
assert.ok(!roleOnly.includes('class="value"') && roleOnly.includes('class="role"'));
ok("empty value line renders only the role line");

// 4. PNG is exactly 1584×396, with the plain background and with an image background.
function pngSize(buf: Buffer) {
  assert.equal(buf.subarray(1, 4).toString("ascii"), "PNG");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}
try {
  const plain = await renderBannerPng(bannerHtml(base, { fontSrc: fontData, backgroundSrc: null }));
  await fs.writeFile(path.join(OUT, "plain.png"), plain);
  assert.deepEqual(pngSize(plain), { width: 1584, height: 396 });
  ok("plain background PNG is 1584x396");
  // 5. A background's colour chunks are dropped, so it renders with its raw pixel values like a CSS colour.
  const tagged = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAABGdBTUEAALGPC/xhBQAAAAxJREFUCNdjEJJyBQAAsgB2mCIcPgAAAABJRU5ErkJggg==", "base64");
  const chunks = (b: Buffer) => { const out: string[] = []; for (let at = 8; at + 12 <= b.length; at += 12 + b.readUInt32BE(at)) out.push(b.toString("latin1", at + 4, at + 8)); return out; };
  assert.deepEqual(chunks(tagged), ["IHDR", "gAMA", "IDAT", "IEND"]);
  assert.deepEqual(chunks(stripColorChunks(tagged)), ["IHDR", "IDAT", "IEND"]);
  assert.equal(stripColorChunks(Buffer.from("not a png")).toString(), "not a png");
  ok("colour chunks are stripped from backgrounds");
  if (bg) {
    const withBg = await renderBannerPng(bannerHtml(base, { fontSrc: fontData, backgroundSrc: `data:image/png;base64,${bg.toString("base64")}` }));
    await fs.writeFile(path.join(OUT, "with-background.png"), withBg);
    assert.deepEqual(pngSize(withBg), { width: 1584, height: 396 });
    ok("image background PNG is 1584x396");
  } else {
    console.log("skip - image background (.scratch/linkedin-banner/banner-bg.png not present)");
  }
} finally {
  await (await getBrowser()).close();
}
console.log(`check:banner: ${passed} passed; renders in ${path.relative(process.cwd(), OUT)}/`);
