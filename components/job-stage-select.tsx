"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { stageOptions, stageValue } from "@/lib/jobs/format";
import { STAGES } from "@/lib/jobs/schema";
import type { ClosedReason, JobStage } from "@/lib/jobs/types";
import { useProfile } from "@/components/use-profile";
import { apiPath } from "@/lib/profile-url";

export function JobStageSelect({ id, stage, closedReason }: { id: string; stage: JobStage; closedReason: ClosedReason | null }) {
  const profile = useProfile();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function change(value: string) {
    const [next, reason] = value.split(":");
    setBusy(true);
    setError(false);
    try {
      const res = await fetch(apiPath(profile, `/jobs/${id}`), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(reason ? { stage: next, closedReason: reason } : { stage: next }),
      });
      if (!res.ok) return setError(true);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <select
      className="stage-select"
      aria-label="Stage"
      value={stageValue(stage, closedReason)}
      disabled={busy}
      onChange={(e) => change(e.target.value)}
      data-error={error || undefined}
    >
      {stageOptions(STAGES, { stage, closedReason }).map((o) => (
        <option key={o.value} value={o.value} disabled={o.value === "CLOSED"}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
