"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** The CV folder on the CVs page: where saved PDFs are copied, with Show in Finder and Copy all. */
export function CvFolderBar({ profile, folder, warning }: { profile: string; folder: string | null; warning: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(folder ?? "");
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const api = (p: string) => `/api/p/${profile}${p}`;

  async function call(url: string, init: RequestInit): Promise<Record<string, unknown> | null> {
    setMessage(null);
    try {
      const res = await fetch(url, init);
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setMessage({ text: String(body.error ?? `HTTP ${res.status}`), error: true });
        return null;
      }
      return body;
    } catch (e) {
      setMessage({ text: `Fenix didn't answer: ${(e as Error).message}`, error: true });
      return null;
    }
  }

  async function save() {
    const body = await call(api("/settings"), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cvFolder: value.trim() === "" ? null : value }),
    });
    if (!body) return;
    setEditing(false);
    router.refresh();
  }

  async function open() {
    if (await call(api("/cv-folder/open"), { method: "POST" })) setMessage({ text: "Opened.", error: false });
  }

  async function copyAll() {
    const body = await call(api("/cv-folder/sync"), { method: "POST" });
    if (body) {
      const warnings = (body.warnings as string[]) ?? [];
      setMessage({ text: `Copied ${body.copied} PDF${body.copied === 1 ? "" : "s"}.${warnings.length ? ` ${warnings.join(" ")}` : ""}`, error: warnings.length > 0 });
    }
  }

  return (
    <section className="cv-folder" aria-label="CV folder">
      {editing ? (
        <form
          className="cv-folder-edit"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label>
            Copy each saved PDF to <input type="text" value={value} onChange={(e) => setValue(e.target.value)} placeholder="~/Documents/CVs" />
          </label>
          <button type="submit" className="btn">Save</button>
          <button type="button" className="btn" onClick={() => setEditing(false)}>Cancel</button>
          <p className="muted small">A full path. Changing it leaves the copies already in the old folder; use Copy all to fill the new one.</p>
        </form>
      ) : folder ? (
        <div className="cv-folder-row">
          <span>
            PDFs are copied to <code>{folder}</code>
          </span>
          <button type="button" className="btn" onClick={() => void open()}>Show in Finder</button>
          <button type="button" className="btn" onClick={() => void copyAll()}>Copy all</button>
          <button type="button" className="btn" onClick={() => setEditing(true)}>Change</button>
        </div>
      ) : (
        <div className="cv-folder-row">
          <span className="muted">Saved PDFs stay in Fenix&rsquo;s data folder. Pick a folder to get a copy of each one where you can grab it.</span>
          <button type="button" className="btn" onClick={() => setEditing(true)}>Choose a folder</button>
        </div>
      )}
      {warning && <p className="form-error">{warning}</p>}
      {message && <p className={message.error ? "form-error" : "muted small"}>{message.text}</p>}
    </section>
  );
}
