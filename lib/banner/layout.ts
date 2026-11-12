import type { BannerRecord } from "@/lib/store/schemas";

// Pure (no Node imports): the editor preview and the server export both build the banner with bannerHtml.
export const BANNER_W = 1584;
export const BANNER_H = 396;

// The approved 2026-11-09 banner at textScale 1.
const VALUE_PX = 44;
const ROLE_PX = 30;
const VALUE_LINE_HEIGHT = 1.24;
const ROLE_GAP_PX = 12;
const RIGHT_MARGIN_PX = 48;
const ROLE_COLOR = "#D6DEEA";
export const PLAIN_BACKGROUND = "linear-gradient(90deg, #0F1E3D 0%, #1B2B45 100%)";

// Where LinkedIn's round profile photo sits over the banner, measured from 2026-11-09 screenshots of a real profile.
export const PHOTO = {
  desktop: { diameter: 0.81, left: 0.03, top: 0.52 },
  phone: { diameter: 1.03, left: 0.04, top: 0.52 },
} as const;

export type BannerAssets = { fontSrc: string; backgroundSrc: string | null };
export type BannerLayout = Pick<BannerRecord, "valueLine" | "roleLine" | "textScale" | "textCenterY" | "cropY">;

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const cssUrl = (src: string) => `url("${src.replace(/["\\\n]/g, (c) => encodeURIComponent(c))}")`;
const px = (n: number) => `${Math.round(n * 100) / 100}px`;

export function bannerHtml(b: BannerLayout, assets: BannerAssets): string {
  const s = b.textScale;
  const background = assets.backgroundSrc
    ? `${cssUrl(assets.backgroundSrc)} center ${Math.round(b.cropY * 1000) / 10}% / cover no-repeat, #0F1E3D`
    : PLAIN_BACKGROUND;
  const value = b.valueLine.trim() ? `<div class="value">${escapeHtml(b.valueLine.replace(/\r/g, ""))}</div>` : "";
  const role = b.roleLine.trim() ? `<div class="role">${escapeHtml(b.roleLine)}</div>` : "";
  return `<!doctype html>
<html><head><meta charset="utf-8">
<style>
@font-face { font-family: "Banner Sans"; src: ${cssUrl(assets.fontSrc)} format("truetype"); font-weight: 300 800; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: ${BANNER_W}px; height: ${BANNER_H}px; overflow: hidden; }
body { background: ${background}; font-family: "Banner Sans", sans-serif; color: #fff; position: relative; -webkit-font-smoothing: antialiased; }
.text { position: absolute; right: ${RIGHT_MARGIN_PX}px; top: ${b.textCenterY * 100}%; transform: translateY(-50%); text-align: right; }
.value { font-weight: 700; font-size: ${px(VALUE_PX * s)}; line-height: ${VALUE_LINE_HEIGHT}; white-space: pre; }
.role { font-weight: 400; font-size: ${px(ROLE_PX * s)}; line-height: 1.3; color: ${ROLE_COLOR}; white-space: pre; }
.value + .role { margin-top: ${px(ROLE_GAP_PX * s)}; }
</style></head>
<body><div class="text">${value}${role}</div></body></html>`;
}
