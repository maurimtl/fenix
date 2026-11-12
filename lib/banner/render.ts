import { promises as fs } from "node:fs";
import path from "node:path";
import { getBrowser } from "@/lib/pdf/render";
import { readBackground } from "@/lib/store/banner";
import { StoreError } from "@/lib/store/paths";
import type { BannerRecord } from "@/lib/store/schemas";
import { BANNER_H, BANNER_W, bannerHtml } from "./layout";

const FONT_FILE = path.join(process.cwd(), "public", "fonts", "OpenSans.ttf");

/** Screenshot of the banner at exactly 1584×396. The person's text is escaped and the page runs no script. */
export async function renderBannerPng(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: BANNER_W, height: BANNER_H },
    deviceScaleFactor: 1,
    javaScriptEnabled: false,
  });
  try {
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    return await page.screenshot({ type: "png" });
  } finally {
    await context.close();
  }
}

let fontDataUri: Promise<string> | null = null;

/** The server's copy of the banner: font and background inlined as data: URIs, so the page loads nothing. */
export async function bannerHtmlForExport(profile: string, b: BannerRecord): Promise<string> {
  fontDataUri ??= fs.readFile(FONT_FILE).then(
    (f) => `data:font/ttf;base64,${f.toString("base64")}`,
    (e) => {
      fontDataUri = null;
      throw e;
    },
  );
  const bg = b.background ? await readBackground(profile, b.background) : null;
  // A selected background that's missing would silently export plain navy instead of what the preview showed.
  if (b.background && !bg) throw new StoreError("not_found", `background ${b.background} is missing from linkedin/backgrounds/`);
  return bannerHtml(b, {
    fontSrc: await fontDataUri,
    backgroundSrc: bg ? `data:image/png;base64,${bg.toString("base64")}` : null,
  });
}
