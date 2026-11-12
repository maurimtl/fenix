"use client";

import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { useState } from "react";
import { useProfile } from "@/components/use-profile";
import { apiPath, pagePath } from "@/lib/profile-url";


type Bullet = { id: string; text: string; altText: string; altCurrency: string };
type Position = { id: string; company: string; title: string; bullets: Bullet[] };
type ProfileData = {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  about: string;
};

type Versions = { career: string; profile: string };
type Saved = { ok: true; version: string } | { ok: false; stale: boolean };

async function send(url: string, method: string, body?: unknown): Promise<Saved & { id?: string }> {
  const res = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return res.ok ? { ok: true, version: data.version, id: data.id } : { ok: false, stale: res.status === 409 };
}

const STALE = "This changed elsewhere. Reload to see the latest.";

export function CanonicalEditor({
  data,
  versions: initialVersions,
}: {
  data: { profile: ProfileData; positions: Position[] };
  versions: Versions;
}) {
  const slug = useProfile();
  const [profile, setProfile] = useState(data.profile);
  const [positions, setPositions] = useState(data.positions);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [versions, setVersions] = useState(initialVersions);

  function flash(msg: string, sticky = false) {
    setSavedMsg(msg);
    if (!sticky) setTimeout(() => setSavedMsg(null), 1500);
  }

  // Applies a save result: keeps the new file version, or reports why it failed.
  function settle(file: keyof Versions, r: Saved, okMsg: string): boolean {
    if (r.ok) {
      setVersions((v) => ({ ...v, [file]: r.version }));
      flash(okMsg);
      return true;
    }
    flash(r.stale ? STALE : "⚠ Save failed", r.stale);
    return false;
  }

  async function saveProfile() {
    settle("profile", await send(apiPath(slug, "/canonical/profile"), "PATCH", { ...profile, version: versions.profile }), "Profile saved");
  }

  function setPos(id: string, fn: (p: Position) => Position) {
    setPositions((prev) => prev.map((p) => (p.id === id ? fn(p) : p)));
  }

  async function saveTitle(p: Position) {
    settle("career", await send(apiPath(slug, `/canonical/positions/${p.id}`), "PATCH", { title: p.title, version: versions.career }), "Title saved");
  }
  async function saveBullet(pid: string, b: Bullet) {
    const body = { text: b.text, altText: b.altText, altCurrency: b.altCurrency, version: versions.career };
    settle("career", await send(apiPath(slug, `/canonical/bullets/${b.id}`), "PATCH", body), "Bullet saved");
  }
  async function addBullet(pid: string) {
    const r = await send(apiPath(slug, "/canonical/bullets"), "POST", { positionId: pid, text: "New bullet", version: versions.career });
    if (!settle("career", r, "Bullet added") || !r.id) return;
    const id = r.id;
    setPos(pid, (p) => ({
      ...p,
      bullets: [...p.bullets, { id, text: "New bullet", altText: "", altCurrency: "" }],
    }));
  }
  async function deleteBullet(pid: string, bid: string) {
    const url = apiPath(slug, `/canonical/bullets/${bid}?version=${encodeURIComponent(versions.career)}`);
    if (!settle("career", await send(url, "DELETE"), "Bullet deleted")) return;
    setPos(pid, (p) => ({ ...p, bullets: p.bullets.filter((b) => b.id !== bid) }));
  }

  const field = (
    key: keyof ProfileData,
    label: string,
    textarea = false
  ) => (
    <label className="fld">
      <span>{label}</span>
      {textarea ? (
        <textarea
          rows={key === "about" ? 6 : 3}
          value={profile[key]}
          onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
        />
      ) : (
        <input
          value={profile[key]}
          onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
        />
      )}
    </label>
  );

  return (
    <>
    <AppHeader />
    <main className="page">
      <div className="page-head">
        <h1>Career record</h1>
        <Link href={pagePath(slug, "/cv/base")}>Preview base résumé</Link>
        {savedMsg && (
          <span
            style={{
              color: savedMsg.startsWith("⚠") ? "#b91c1c" : "#059669",
              fontSize: 13,
            }}
          >
            {savedMsg}
          </span>
        )}
      </div>

      <p className="lede" style={{ marginTop: -12, marginBottom: 20 }}>
        Your full career history, kept as written. Every CV starts from this; edits here show up in
        your CVs without overwriting the rewrites you made in them.
      </p>

      <section className="editor-section">
        <h3>Profile</h3>
        {field("fullName", "Full name")}
        {field("headline", "Default headline")}
        {field("email", "Email")}
        {field("phone", "Phone")}
        {field("location", "Location")}
        {field("summary", "Default summary", true)}
        {field("about", "About (AI source material)", true)}
        <button className="btn btn-primary" onClick={saveProfile}>
          Save profile
        </button>
      </section>

      <section className="editor-section">
        <h3>Experience</h3>
        {positions.map((p) => (
          <div key={p.id} className="pos-card">
            <div className="pos-co">{p.company}</div>
            <div style={{ display: "flex", gap: 6, margin: "4px 0 10px" }}>
              <input
                value={p.title}
                onChange={(e) => setPos(p.id, (x) => ({ ...x, title: e.target.value }))}
                style={{ flex: 1, padding: "5px 7px", fontSize: 13 }}
              />
              <button className="btn" onClick={() => saveTitle(p)}>
                Save title
              </button>
            </div>
            {p.bullets.map((b) => (
              <div key={b.id} className="bullet-row">
                <textarea
                  rows={2}
                  value={b.text}
                  onChange={(e) =>
                    setPos(p.id, (x) => ({
                      ...x,
                      bullets: x.bullets.map((bb) =>
                        bb.id === b.id ? { ...bb, text: e.target.value } : bb
                      ),
                    }))
                  }
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <button className="mini" onClick={() => saveBullet(p.id, b)}>
                    save
                  </button>
                  <button className="mini" onClick={() => deleteBullet(p.id, b.id)}>
                    delete
                  </button>
                </div>
              </div>
            ))}
            <button className="mini" onClick={() => addBullet(p.id)}>
              + add bullet
            </button>
          </div>
        ))}
      </section>
    </main>
    </>
  );
}
