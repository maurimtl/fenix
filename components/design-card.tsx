"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  profile: string;
  id: string;
  name: string;
  description: string;
  personal: boolean;
  isDefault: boolean;
};

/** One design on the Designs page: its page-1 preview, and a button that makes it the person's default. */
export function DesignCard({ profile, id, name, description, personal, isDefault }: Props) {
  const router = useRouter();
  const [broken, setBroken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = `/api/p/${profile}/designs/${encodeURIComponent(id)}/preview`;

  async function makeDefault() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/p/${profile}/settings`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ defaultTemplate: id }),
    });
    setBusy(false);
    if (!res.ok) setError(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? `HTTP ${res.status}`);
    else router.refresh();
  }

  return (
    <article className={`design-card${isDefault ? " is-default" : ""}`}>
      {broken ? (
        <div className="design-broken">
          This design couldn&rsquo;t be rendered. <a href={preview}>See the error</a>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- a generated PNG from our own route, not a static asset
        <img src={preview} alt={`${name}: page 1 with your career record`} loading="lazy" width={816} height={1056} onError={() => setBroken(true)} />
      )}
      <div className="design-meta">
        <h2>
          {name}
          {personal && <span className="design-tag">Yours</span>}
          {isDefault && <span className="design-tag design-tag-default">Default</span>}
        </h2>
        <p className="muted">{description}</p>
        {!isDefault && (
          <button type="button" className="btn" onClick={makeDefault} disabled={busy}>
            {busy ? "Saving…" : "Make default"}
          </button>
        )}
        {error && <p className="form-error">{error}</p>}
      </div>
    </article>
  );
}
