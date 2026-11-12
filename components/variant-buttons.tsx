"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useProfile } from "@/components/use-profile";
import { apiPath, pagePath } from "@/lib/profile-url";


export function NewVariantButton() {
  const profile = useProfile();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(apiPath(profile, "/variants"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.id) {
        setError(data.error || "Could not create variant.");
        setBusy(false);
        return;
      }
      router.push(pagePath(profile, `/cv/${data.id}`));
    } catch {
      setError("Network error.");
      setBusy(false);
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      {error && <span style={{ color: "#b91c1c", fontSize: 13 }}>{error}</span>}
      <button className="btn btn-primary" onClick={create} disabled={busy}>
        {busy ? "Creating…" : "New blank CV"}
      </button>
    </span>
  );
}

export function TailorForm() {
  const profile = useProfile();
  const router = useRouter();
  const [jd, setJd] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(apiPath(profile, "/tailor"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jd, name: name || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Tailoring failed.");
        setBusy(false);
        return;
      }
      router.push(pagePath(profile, `/cv/${data.id}`));
    } catch {
      setError("Network error.");
      setBusy(false);
    }
  }

  return (
    <section className="tailor">
      <h2>Tailor from a job description</h2>
      <p className="tailor-hint">
        Paste a job description and Claude drafts a headline, summary and reworded
        bullets from your career record. Nothing is final until you edit it. Each draft is a
        paid Claude API call.
      </p>
      <input
        className="tailor-name"
        placeholder="CV name, e.g. Acme - Director of Product (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={busy}
      />
      <textarea
        className="tailor-jd"
        placeholder="Paste the full job description here…"
        rows={7}
        value={jd}
        onChange={(e) => setJd(e.target.value)}
        disabled={busy}
      />
      {error && <div className="tailor-error">{error}</div>}
      <button
        className="btn btn-primary"
        onClick={go}
        disabled={busy || jd.trim().length < 20}
      >
        {busy ? "Drafting… (can take ~30s)" : "Draft a tailored CV"}
      </button>
    </section>
  );
}

export function RowActions({ id, name }: { id: string; name: string }) {
  const profile = useProfile();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function duplicate() {
    setBusy(true);
    await fetch(apiPath(profile, "/variants"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sourceId: id }),
    });
    setBusy(false);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    await fetch(apiPath(profile, `/variants/${id}`), { method: "DELETE" });
    setBusy(false);
    setConfirming(false);
    router.refresh();
  }

  return (
    <span style={{ display: "inline-flex", gap: 8 }}>
      <button className="btn" onClick={duplicate} disabled={busy}>
        Duplicate
      </button>
      {confirming ? (
        <>
          <button className="btn" onClick={remove} disabled={busy}>
            Confirm delete
          </button>
          <button className="btn" onClick={() => setConfirming(false)} disabled={busy}>
            Cancel
          </button>
        </>
      ) : (
        <button
          className="btn"
          onClick={() => setConfirming(true)}
          disabled={busy}
          aria-label={`Delete ${name}`}
        >
          Delete
        </button>
      )}
    </span>
  );
}
