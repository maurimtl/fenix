"use client";

import { useRef, useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { useProfile } from "@/components/use-profile";
import { apiPath } from "@/lib/profile-url";
import { toLinkedInPaste, visibleLength } from "@/lib/linkedin/format";
import { sectionText, type LinkedinSection } from "@/lib/linkedin/sections";
import type { LinkedinProfile } from "@/lib/store/schemas";

export type LinkedinRow = { key: string; title: string; limit: number; section: LinkedinSection; draft: string | null };

type Props = { initial: LinkedinProfile; initialVersion: string; rows: LinkedinRow[]; readOnly?: boolean };

export function LinkedinEditor({ initial, initialVersion, rows, readOnly = false }: Props) {
  const profile = useProfile();
  const [live, setLive] = useState(initial);
  const [error, setError] = useState("");
  // Requests run one at a time and each sends the version the previous one returned, so two quick actions on
  // different rows never look like a conflict.
  const version = useRef(initialVersion);
  const chain = useRef<Promise<boolean>>(Promise.resolve(true));

  function send(path: string, method: string, body: object): Promise<boolean> {
    const run = async () => {
      setError("");
      const res = await fetch(apiPath(profile, path), { method, headers: { "content-type": "application/json" }, body: JSON.stringify({ version: version.current, ...body }) });
      const out = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setError(out.error?.startsWith("the draft changed") ? out.error : "Changed elsewhere (another tab or Claude). Reload to see the latest before saving.");
        return false;
      }
      if (!res.ok) {
        setError(out.error ?? `Save failed (${res.status})`);
        return false;
      }
      setLive(out.linkedin);
      version.current = out.version;
      return true;
    };
    const next = chain.current.then(run, run);
    chain.current = next;
    return next;
  }

  return (
    <>
      {error && <p className="banner banner-fail">{error}</p>}
      <p className="variant-meta">
        {live.readAt ? `Last read from LinkedIn ${live.readAt}.` : "Not read from LinkedIn yet."} Changes made on LinkedIn itself show here after the
        next read (ask Claude to read your LinkedIn profile) or when you edit them below.
      </p>
      {!rows.some((r) => r.section.kind === "role") && (
        <p className="variant-meta">Roles appear here once Claude reads your LinkedIn profile or drafts role text.</p>
      )}
      {rows.map((row) => (
        <Row
          key={row.key}
          row={row}
          current={sectionText(live, row.section)}
          readOnly={readOnly}
          onSave={(text) => send("/linkedin", "PATCH", { section: row.section, text })}
          onApply={() => send("/linkedin/apply", "POST", { section: row.section, text: row.draft })}
        />
      ))}
    </>
  );
}

function Count({ text, limit }: { text: string; limit: number }) {
  const n = visibleLength(toLinkedInPaste(text));
  return <span className={n > limit ? "li-count li-over" : "li-count"}>{n.toLocaleString("en")} / {limit.toLocaleString("en")}</span>;
}

type RowProps = { row: LinkedinRow; current: string; readOnly: boolean; onSave: (t: string) => Promise<boolean>; onApply: () => Promise<boolean> };

function Row({ row, current, readOnly, onSave, onApply }: RowProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = row.draft !== null && row.draft !== current;
  const run = async (f: () => Promise<boolean>) => {
    setBusy(true);
    if (await f()) setEditing(null);
    setBusy(false);
  };

  return (
    <section className="li-section">
      <div className="li-head">
        <h2>{row.title}</h2>
        <Count text={editing ?? current} limit={row.limit} />
        {editing === null && current && <CopyButton text={toLinkedInPaste(current)} />}
        {editing === null && !readOnly && (
          <button className="btn" onClick={() => setEditing(current)}>
            Edit
          </button>
        )}
      </div>
      <div className="li-label">On LinkedIn now</div>
      {editing === null ? (
        <pre className="li-text">{current || <span className="muted">Not recorded yet.</span>}</pre>
      ) : (
        <div className="li-edit">
          <textarea
            className="li-text"
            aria-label={`${row.title} on LinkedIn now`}
            rows={row.section.kind === "headline" ? 2 : 8}
            value={editing}
            onChange={(e) => setEditing(e.target.value)}
          />
          <div className="li-edit-actions">
            <button className="btn btn-primary" disabled={busy} onClick={() => run(() => onSave(editing))}>
              Save
            </button>
            <button className="btn" disabled={busy} onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {pending && (
        <div className="li-proposed">
          <div className="li-head">
            <div className="li-label">Proposed</div>
            <Count text={row.draft!} limit={row.limit} />
            <CopyButton text={toLinkedInPaste(row.draft!)} />
            {!readOnly && (
              <button className="btn" disabled={busy} onClick={() => run(onApply)} title="I pasted this into LinkedIn">
                Mark as applied
              </button>
            )}
          </div>
          <pre className="li-text">{row.draft}</pre>
        </div>
      )}
    </section>
  );
}
