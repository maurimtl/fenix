"use client";

import { PromptBox } from "@/components/prompt-box";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { useProfile } from "@/components/use-profile";
import { apiPath } from "@/lib/profile-url";
import { BANNER_H, BANNER_W, bannerHtml, PHOTO } from "@/lib/banner/layout";
import type { BannerRecord } from "@/lib/store/schemas";

const SAVE_DELAY_MS = 600;
const MAX_THUMBS = 24;

type Props = { initial: BannerRecord; initialVersion: string; hasKey: boolean; price: string };
type Status = { kind: "idle" | "saving" | "saved" | "error" | "conflict"; message?: string };

export function BannerEditor({ initial, initialVersion, hasKey, price, prompt }: Props & { prompt: string }) {
  const profile = useProfile();
  const [banner, setBanner] = useState(initial);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [busy, setBusy] = useState<"" | "download" | "generate">("");
  const version = useRef(initialVersion);
  // Edits are numbered; a save records the number it sent, so an edit made while a save is in flight stays unsaved.
  const editSeq = useRef(0);
  const savedSeq = useRef(0);
  const chain = useRef<Promise<boolean>>(Promise.resolve(true));
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conflictRef = useRef(false);
  const conflict = status.kind === "conflict";
  const generating = busy === "generate";
  // Saves read the latest edits through this ref; they always run after a render has committed them.
  const bannerRef = useRef(banner);
  useEffect(() => {
    bannerRef.current = banner;
  }, [banner]);

  const bgUrl = (file: string) => apiPath(profile, `/banner/backgrounds/${encodeURIComponent(file)}`);
  const html = useMemo(
    () => bannerHtml(banner, { fontSrc: "/fonts/OpenSans.ttf", backgroundSrc: banner.background ? bgUrl(banner.background) : null }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [banner.valueLine, banner.roleLine, banner.textScale, banner.textCenterY, banner.cropY, banner.background, profile],
  );

  const patchBody = useCallback((commit: boolean) => {
    const { valueLine, roleLine, textScale, textCenterY, cropY, background, styleNote } = bannerRef.current;
    return JSON.stringify({ version: version.current, commit, valueLine, roleLine, textScale, textCenterY, cropY, background, styleNote });
  }, []);

  // Saves run one at a time, so two never carry the same version (which would make the second a false conflict).
  const save = useCallback(
    (commit: boolean): Promise<boolean> => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      const run = async (): Promise<boolean> => {
        if (conflictRef.current) return false;
        const seq = editSeq.current;
        if (seq === savedSeq.current && !commit) return true;
        setStatus({ kind: "saving" });
        inFlight.current = true;
        const res = await fetch(apiPath(profile, "/banner"), { method: "PATCH", headers: { "content-type": "application/json" }, body: patchBody(commit) }).finally(() => {
          inFlight.current = false;
        });
        if (res.status === 409) {
          conflictRef.current = true;
          setStatus({ kind: "conflict", message: "Changed elsewhere (another tab or Claude). Reload to see it; edits here aren't saved." });
          return false;
        }
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setStatus({ kind: "error", message: body.error ?? `Save failed (${res.status})` });
          return false;
        }
        version.current = body.version;
        savedSeq.current = seq;
        setStatus({ kind: seq === editSeq.current ? "saved" : "saving" });
        return true;
      };
      const next = chain.current.then(run, run);
      chain.current = next;
      return next;
    },
    [profile, patchBody],
  );

  function edit(patch: Partial<BannerRecord>) {
    if (conflictRef.current || generating) return;
    setBanner((b) => ({ ...b, ...patch }));
    editSeq.current++;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(false), SAVE_DELAY_MS);
  }

  // Leaving the page (header link, reload, closing the tab) still sends an edit the debounce hasn't saved yet.
  useEffect(() => {
    const flush = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      if (editSeq.current === savedSeq.current || conflictRef.current) return;
      const send = () => {
        if (editSeq.current === savedSeq.current || conflictRef.current) return;
        savedSeq.current = editSeq.current;
        void fetch(apiPath(profile, "/banner"), { method: "PATCH", keepalive: true, headers: { "content-type": "application/json" }, body: patchBody(false) });
      };
      // A save in flight would make this one's version stale (a false conflict): send after it, with its new version.
      if (inFlight.current) void chain.current.then(send, send);
      else send();
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [profile, patchBody]);

  async function download() {
    setBusy("download");
    try {
      if (!(await save(true))) return;
      const res = await fetch(apiPath(profile, "/banner/export"), { method: "POST" });
      if (!res.ok) {
        setStatus({ kind: "error", message: `Export failed: ${(await res.text()).slice(0, 200)}` });
        return;
      }
      const name = decodeURIComponent(/filename\*=UTF-8''([^;]+)/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "LinkedIn%20banner.png");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } finally {
      setBusy("");
    }
  }

  async function generate() {
    setBusy("generate");
    try {
      if (!(await save(false))) return;
      const res = await fetch(apiPath(profile, "/banner/generate"), { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ kind: "error", message: body.error ?? `Generate failed (${res.status})` });
        return;
      }
      version.current = body.version;
      setBanner(body.banner);
      setStatus({ kind: "saved", message: "New background added." });
    } finally {
      setBusy("");
    }
  }

  const thumbs = [...banner.backgrounds].reverse().slice(0, MAX_THUMBS);

  return (
    <>
      <AppHeader />
      <main className="page page-wide banner-page">
        <div className="page-head">
          <div>
            <h1>LinkedIn banner</h1>
            <p className="lede">Two lines on a navy background, sized for LinkedIn (1584×396). Text is drawn by Fenix, so it is always spelled right.</p>
          </div>
          <div className="banner-actions">
            <span className={`banner-status ${status.kind}`} role="status">
              {status.kind === "saving" ? "Saving…" : status.kind === "saved" ? (status.message ?? "Saved") : (status.message ?? "")}
            </span>
            <button className="btn btn-primary" onClick={download} disabled={busy !== "" || conflict}>
              {busy === "download" ? "Rendering…" : "Download PNG"}
            </button>
          </div>
        </div>

        <PromptBox text={prompt} />

        <section className="banner-previews">
          <ScaledBanner html={html} photo={PHOTO.desktop} label="Desktop" />
          <div className="banner-phone">
            <ScaledBanner html={html} photo={PHOTO.phone} label="Phone" fixedWidth={375} />
          </div>
        </section>

        <fieldset className="banner-controls" disabled={generating || conflict}>
          <div>
            <label className="fld">
              <span>Value line (press Enter where the line should break)</span>
              <textarea rows={3} value={banner.valueLine} maxLength={200} onChange={(e) => edit({ valueLine: e.target.value })} />
            </label>
            <label className="fld">
              <span>Role line</span>
              <input value={banner.roleLine} maxLength={120} onChange={(e) => edit({ roleLine: e.target.value })} />
            </label>
            <label className="fld">
              <span>Text size: {Math.round(banner.textScale * 100)}%</span>
              <input type="range" min={0.6} max={1.6} step={0.02} value={banner.textScale} onChange={(e) => edit({ textScale: Number(e.target.value) })} />
            </label>
            <label className="fld">
              <span>Text height: {Math.round(banner.textCenterY * 100)}% from the top</span>
              <input type="range" min={0.15} max={0.85} step={0.01} value={banner.textCenterY} onChange={(e) => edit({ textCenterY: Number(e.target.value) })} />
            </label>
          </div>

          <div>
            <div className="fld">
              <span>Background</span>
              <div className="banner-thumbs">
                <button
                  className="banner-thumb plain"
                  aria-pressed={!banner.background}
                  onClick={() => edit({ background: null })}
                  title="Plain navy"
                >
                  Plain navy
                </button>
                {thumbs.map((b) => (
                  <button
                    key={b.file}
                    className="banner-thumb"
                    aria-pressed={banner.background === b.file}
                    onClick={() => edit({ background: b.file })}
                    title={`${b.createdAt} · ${b.model}`}
                    style={{ backgroundImage: `url("${bgUrl(b.file)}")` }}
                  />
                ))}
              </div>
            </div>
            {banner.background && (
              <label className="fld">
                <span>Crop: {Math.round(banner.cropY * 100)}% (which strip of the image shows)</span>
                <input type="range" min={0} max={1} step={0.01} value={banner.cropY} onChange={(e) => edit({ cropY: Number(e.target.value) })} />
              </label>
            )}
            <label className="fld">
              <span>Style note for new backgrounds (optional)</span>
              <input value={banner.styleNote ?? ""} maxLength={300} placeholder="e.g. a rising curve instead of loops" onChange={(e) => edit({ styleNote: e.target.value || null })} />
            </label>
            <button className="btn" onClick={generate} disabled={!hasKey || busy !== "" || conflict}>
              {busy === "generate" ? "Generating… (up to a minute)" : "Generate background"}
            </button>
            <p className="small muted banner-price">
              {hasKey ? `OpenAI image, ${price}. Runs only when you click.` : "Add OPENAI_API_KEY to .env to generate backgrounds."}
            </p>
          </div>
        </fieldset>
      </main>
    </>
  );
}

function ScaledBanner({ html, photo, label, fixedWidth }: { html: string; photo: { diameter: number; left: number; top: number }; label: string; fixedWidth?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fixedWidth ?? 0);
  useEffect(() => {
    if (fixedWidth || !box.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, [fixedWidth]);
  const scale = width / BANNER_W;
  const h = BANNER_H * scale;
  const d = photo.diameter * h;
  return (
    <figure className="banner-figure" style={fixedWidth ? { width: fixedWidth } : undefined}>
      <div ref={box} className="banner-frame" style={{ height: h }}>
        {width > 0 && (
          <iframe
            title={`${label} banner preview`}
            srcDoc={html}
            sandbox="allow-same-origin"
            width={BANNER_W}
            height={BANNER_H}
            style={{ transform: `scale(${scale})` }}
          />
        )}
        <div className="banner-photo" style={{ width: d, height: d, left: photo.left * width, top: photo.top * h }} aria-hidden />
      </div>
      <figcaption className="small muted">{label}: the circle is where your profile photo sits</figcaption>
    </figure>
  );
}
