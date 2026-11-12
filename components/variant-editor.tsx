"use client";

import { PromptBox } from "@/components/prompt-box";
import { completeAchievements, KeyAchievementsEditor } from "@/components/key-achievements-editor";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/components/use-profile";
import { apiPath, pagePath } from "@/lib/profile-url";

import { resolve } from "@/lib/resume/resolve";
import {
  parseOverrides,
  type Overrides,
  type PositionOverride,
} from "@/lib/resume/schema";
import type { CanonicalData, CanonicalPosition } from "@/lib/resume/types";

type VariantProp = {
  id: string;
  name: string;
  templateId: string;
  overrides: unknown;
  version: string;
};

const EMPTY_PO: PositionOverride = { mode: "reflow", bullets: {} };

export function VariantEditor({
  canonical,
  variant,
  templates,
  defaultTemplate,
  unbacked,
  designPrompt,
}: {
  canonical: CanonicalData;
  variant: VariantProp;
  templates: { id: string; name: string; personal: boolean; features: string[] }[];
  defaultTemplate: string;
  unbacked: string[];
  designPrompt: string;
}) {
  const profile = useProfile();
  const router = useRouter();
  const [name, setName] = useState(variant.name);
  const [templateId, setTemplateId] = useState(variant.templateId);
  const [ov, setOv] = useState<Overrides>(() => parseOverrides(variant.overrides));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [version, setVersion] = useState(variant.version);

  // The rows being typed may be incomplete; the preview and the save use only the complete ones.
  const saved = useMemo(() => ({ ...ov, keyAchievements: completeAchievements(ov.keyAchievements) }), [ov]);
  const doc = useMemo(
    () => resolve(canonical, saved, templateId),
    [canonical, saved, templateId]
  );
  // The design that will print, chosen the way the server does: this CV's, else the default, else Plain.
  const design =
    templates.find((t) => t.id === templateId) ??
    templates.find((t) => t.id === defaultTemplate) ??
    templates.find((t) => t.id === "plain") ??
    templates[0];

  // Live PDF preview: debounce edits, render the (unsaved) doc to a PDF, embed it.
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      setRendering(true);
      try {
        const res = await fetch(apiPath(profile, "/preview-pdf"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ doc }),
        });
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setPdfUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } finally {
        if (!cancelled) setRendering(false);
      }
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [doc, profile]);

  function update(next: Partial<Overrides>) {
    setOv((prev) => ({ ...prev, ...next }));
    setDirty(true);
  }
  function updatePos(pid: string, fn: (po: PositionOverride) => PositionOverride) {
    setOv((prev) => {
      const cur = prev.positions[pid] ?? EMPTY_PO;
      return { ...prev, positions: { ...prev.positions, [pid]: fn(cur) } };
    });
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(apiPath(profile, `/variants/${variant.id}`), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, templateId, overrides: saved, version }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(res.status === 409 ? "This CV changed elsewhere. Reload to see the latest." : d.error || `Save failed (${res.status})`);
        setSaving(false);
        return;
      }
      setVersion(d.version);
      setDirty(false);
      router.refresh();
    } catch {
      setSaveError("Network error — not saved.");
    }
    setSaving(false);
  }

  // --- skills ---
  const allSkillIds = canonical.skills.map((s) => s.id);
  const skillIsOn = (id: string) =>
    ov.skillIds === undefined || ov.skillIds.includes(id);
  function toggleSkill(id: string) {
    const on = new Set(ov.skillIds ?? allSkillIds);
    if (on.has(id)) on.delete(id);
    else on.add(id);
    update({ skillIds: allSkillIds.filter((x) => on.has(x)) });
  }

  // --- position order ---
  const canonicalOrder = canonical.positions.map((p) => p.id);
  const order = ov.positionOrder ?? canonicalOrder;
  const orderedPositions = [
    ...order
      .map((id) => canonical.positions.find((p) => p.id === id))
      .filter((p): p is CanonicalPosition => Boolean(p)),
    ...canonical.positions.filter((p) => !order.includes(p.id)),
  ];
  function move(pid: string, dir: -1 | 1) {
    const cur = [...(ov.positionOrder ?? canonicalOrder)];
    const i = cur.indexOf(pid);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= cur.length) return;
    [cur[i], cur[j]] = [cur[j], cur[i]];
    update({ positionOrder: cur });
  }

  return (
    <div className="editor-layout">
      <aside className="editor-panel">
        <div className="editor-toolbar">
          <a className="btn" href={pagePath(profile, "/variants")}>
            ← CVs
          </a>
          <span className="spacer" />
          <a className="btn" href={apiPath(profile, `/cv/${variant.id}/pdf`)}>
            PDF
          </a>
          <button className="btn btn-primary" onClick={save} disabled={saving || !dirty}>
            {saving ? "Saving…" : dirty ? "Save" : "Saved"}
          </button>
        </div>
        {saveError && <div className="tailor-error">{saveError}</div>}
        {unbacked.length > 0 && (
          <div className="tailor-error">
            Not in your career record or stories, as last saved: {unbacked.join(", ")}. Fix the wording, or add the
            number to the career record or a story, before sending this CV.
          </div>
        )}

        <label className="fld">
          <span>Variant name</span>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setDirty(true);
            }}
          />
        </label>

        <label className="fld">
          <span>Design</span>
          <select
            value={templateId}
            onChange={(e) => {
              setTemplateId(e.target.value);
              setDirty(true);
            }}
          >
            {!templates.some((t) => t.id === templateId) && <option value={templateId}>{templateId || "Default"}</option>}
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.personal ? " (yours)" : ""}
              </option>
            ))}
          </select>
        </label>
        <PromptBox text={designPrompt} label="Want a different design? Tell Claude" />

        <label className="fld">
          <span>Headline</span>
          <input
            value={ov.headline ?? ""}
            placeholder={canonical.profile.headline}
            onChange={(e) => update({ headline: e.target.value || undefined })}
          />
        </label>

        <label className="fld">
          <span>Summary</span>
          <textarea
            rows={6}
            value={ov.summary ?? ""}
            placeholder={canonical.profile.summary}
            onChange={(e) => update({ summary: e.target.value || undefined })}
          />
        </label>

        <KeyAchievementsEditor
          items={ov.keyAchievements ?? []}
          onChange={(keyAchievements) => update({ keyAchievements })}
          shownBy={templates.filter((t) => t.features.includes("keyAchievements")).map((t) => t.name)}
          designName={design?.name ?? (templateId || "this design")}
          shownHere={design?.features.includes("keyAchievements") ?? false}
        />

        <label className="fld">
          <span>Currency</span>
          <select value={ov.currency} onChange={(e) => update({ currency: e.target.value })}>
            <option value="USD">USD (default)</option>
            <option value="CAD">CAD</option>
          </select>
        </label>

        <div className="fld">
          <span>Skills shown</span>
          {canonical.skills.map((s) => (
            <label key={s.id} className="chk">
              <input type="checkbox" checked={skillIsOn(s.id)} onChange={() => toggleSkill(s.id)} />
              {s.name}
            </label>
          ))}
        </div>

        <div className="editor-section">
          <h3>Experience</h3>
          {orderedPositions.map((p, idx) => (
            <PositionCard
              key={p.id}
              p={p}
              po={ov.positions[p.id]}
              isFirst={idx === 0}
              isLast={idx === orderedPositions.length - 1}
              onMove={(dir) => move(p.id, dir)}
              updatePos={(fn) => updatePos(p.id, fn)}
            />
          ))}
        </div>
      </aside>

      <div className="editor-preview">
        {rendering && <div className="preview-updating">Updating preview…</div>}
        {pdfUrl ? (
          <iframe className="pdf-frame" title="Résumé preview" src={pdfUrl} />
        ) : (
          <div className="preview-updating">Rendering preview…</div>
        )}
      </div>
    </div>
  );
}

function PositionCard({
  p,
  po,
  isFirst,
  isLast,
  onMove,
  updatePos,
}: {
  p: CanonicalPosition;
  po: PositionOverride | undefined;
  isFirst: boolean;
  isLast: boolean;
  onMove: (dir: -1 | 1) => void;
  updatePos: (fn: (po: PositionOverride) => PositionOverride) => void;
}) {
  const mode = po?.mode ?? "reflow";
  const hidden = po?.hidden ?? false;
  const bulletOv = po?.bullets ?? {};
  const canonicalBulletIds = p.bullets.map((b) => b.id);

  function setTitle(v: string) {
    updatePos((cur) => ({ ...cur, titleOverride: v || undefined }));
  }
  function toggleHidden() {
    updatePos((cur) => ({ ...cur, hidden: !(cur.hidden ?? false) }));
  }
  function setMode(next: "reflow" | "curated") {
    updatePos((cur) => {
      if (next === "curated" && !cur.includedBulletIds) {
        // snapshot currently-visible bullets (canonical order minus hidden)
        const included = canonicalBulletIds.filter(
          (id) => !(cur.bullets?.[id]?.hidden ?? false)
        );
        return { ...cur, mode: next, includedBulletIds: included };
      }
      return { ...cur, mode: next };
    });
  }
  function reword(bid: string, v: string) {
    updatePos((cur) => ({
      ...cur,
      bullets: {
        ...cur.bullets,
        [bid]: { ...cur.bullets?.[bid], reworded: v || undefined },
      },
    }));
  }
  function toggleReflowHide(bid: string) {
    updatePos((cur) => ({
      ...cur,
      bullets: {
        ...cur.bullets,
        [bid]: { ...cur.bullets?.[bid], hidden: !(cur.bullets?.[bid]?.hidden ?? false) },
      },
    }));
  }
  function toggleCuratedInclude(bid: string) {
    updatePos((cur) => {
      const base = cur.includedBulletIds ?? canonicalBulletIds;
      const set = new Set(base);
      if (set.has(bid)) set.delete(bid);
      else set.add(bid);
      return { ...cur, includedBulletIds: canonicalBulletIds.filter((x) => set.has(x)) };
    });
  }
  const includedSet = new Set(po?.includedBulletIds ?? canonicalBulletIds);

  return (
    <div className="pos-card" style={hidden ? { opacity: 0.55 } : undefined}>
      <div className="pos-head">
        <div style={{ flex: 1 }}>
          <input
            value={po?.titleOverride ?? ""}
            placeholder={p.title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: "100%", fontSize: 13, padding: "5px 7px" }}
          />
          <div className="pos-co">{p.companyName}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end" }}>
          <span>
            <button className="mini" onClick={() => onMove(-1)} disabled={isFirst}>
              ↑
            </button>
            <button className="mini" onClick={() => onMove(1)} disabled={isLast}>
              ↓
            </button>
          </span>
          <button className="mini" onClick={toggleHidden}>
            {hidden ? "show" : "hide role"}
          </button>
        </div>
      </div>

      {!hidden && (
        <>
          <div style={{ margin: "4px 0 8px" }}>
            <span className="tag">mode</span>{" "}
            <label className="chk" style={{ display: "inline-flex", marginRight: 10 }}>
              <input
                type="radio"
                name={`mode-${p.id}`}
                checked={mode === "reflow"}
                onChange={() => setMode("reflow")}
              />
              reflow
            </label>
            <label className="chk" style={{ display: "inline-flex" }}>
              <input
                type="radio"
                name={`mode-${p.id}`}
                checked={mode === "curated"}
                onChange={() => setMode("curated")}
              />
              curated
            </label>
          </div>

          {p.bullets.length === 0 && (
            <div className="pos-co">No canonical bullets.</div>
          )}
          {p.bullets.map((b) => {
            const shown =
              mode === "curated"
                ? includedSet.has(b.id)
                : !(bulletOv[b.id]?.hidden ?? false);
            return (
              <div className="bullet-row" key={b.id}>
                <input
                  type="checkbox"
                  checked={shown}
                  onChange={() =>
                    mode === "curated"
                      ? toggleCuratedInclude(b.id)
                      : toggleReflowHide(b.id)
                  }
                  style={{ marginTop: 6 }}
                  title={mode === "curated" ? "include" : "show"}
                />
                <textarea
                  rows={2}
                  value={bulletOv[b.id]?.reworded ?? ""}
                  placeholder={b.text}
                  onChange={(e) => reword(b.id, e.target.value)}
                />
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
