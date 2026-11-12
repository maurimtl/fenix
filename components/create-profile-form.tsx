"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { pagePath } from "@/lib/profile-url";

export function CreateProfileForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/profiles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 201) {
      router.push(pagePath(data.slug, "/home"));
      return;
    }
    setError(data.error ?? "Couldn't create the profile");
    setBusy(false);
  }

  return (
    <form className="create-profile" onSubmit={submit}>
      <label htmlFor="new-profile-name">Add a person</label>
      <div className="create-profile-row">
        <input
          id="new-profile-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          maxLength={120}
          required
        />
        <button className="btn btn-primary" disabled={busy || !name.trim()}>
          {busy ? "Creating…" : "Create profile"}
        </button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}
