import { chromium, type Browser } from "playwright";

// Pool one browser across requests (localhost, single user) so the live editor
// preview re-renders quickly instead of paying a cold launch each time.
let browserPromise: Promise<Browser> | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch().catch((err) => {
      browserPromise = null;
      throw err;
    });
  }
  return browserPromise;
}

/** How every CV is printed; the template parse check prints the same way. */
export const PDF_OPTIONS = { format: "Letter", printBackground: true, preferCSSPageSize: true } as const;

/**
 * Navigate to a print page and return a Letter PDF buffer. `printBackground`
 * paints the navy sidebar; `preferCSSPageSize` honours the template's `@page`
 * size + margins. `load` (not `networkidle`) — the page is static and the dev
 * server's HMR websocket would keep `networkidle` from settling.
 */
export async function renderPdf(url: string): Promise<Buffer> {
  const browser = await getBrowser();
  // A fresh context per render: no cookies or storage carry over between people's CVs.
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "load", timeout: 30_000 });
    return await page.pdf(PDF_OPTIONS);
  } finally {
    await context.close();
  }
}

/**
 * Page 1 of a print page as a PNG, for design previews. A screenshot ignores `@page` margins, so the template's own
 * page margins are applied as padding first; the image is one Letter page at 96 dpi.
 */
export async function renderPng(url: string): Promise<Buffer> {
  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: { width: 816, height: 1056 } });
  const page = await context.newPage();
  try {
    const res = await page.goto(url, { waitUntil: "load", timeout: 30_000 });
    if (!res || !res.ok()) throw new Error((await res?.text())?.slice(0, 300) || `print page answered ${res?.status()}`);
    await page.emulateMedia({ media: "print" });
    await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        for (const rule of Array.from(sheet.cssRules)) {
          if (rule instanceof CSSPageRule && rule.selectorText === "") {
            const s = document.documentElement.style;
            s.paddingTop = rule.style.marginTop;
            s.paddingRight = rule.style.marginRight;
            s.paddingBottom = rule.style.marginBottom;
            s.paddingLeft = rule.style.marginLeft;
            return;
          }
        }
      }
    });
    return await page.screenshot({ clip: { x: 0, y: 0, width: 816, height: 1056 }, type: "png" });
  } finally {
    await context.close();
  }
}
