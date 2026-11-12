import type { ResumeDocument } from "@/lib/resume/types";

// Short-lived in-memory store so the print page can render an unsaved editor
// document without persisting it. Pinned to `globalThis` because Next bundles the API route and the /print page separately —
// a plain module-level Map would give each its own copy, so the token written
// by the preview-pdf route wouldn't be found when Playwright loads /print/<profile>/<token>.
const g = globalThis as unknown as {
  __previewStore?: Map<string, { profile: string; doc: ResumeDocument }>;
  __previewSeq?: number;
};
const store = (g.__previewStore ??= new Map<string, { profile: string; doc: ResumeDocument }>());

export function putPreview(profile: string, doc: ResumeDocument): string {
  const seq = (g.__previewSeq = (g.__previewSeq ?? 0) + 1);
  const token = `pv_${seq}_${Math.random().toString(36).slice(2)}`;
  store.set(token, { profile, doc });
  setTimeout(() => store.delete(token), 60_000);
  return token;
}

// A token only opens under the profile that created it.
export function getPreview(profile: string, token: string): ResumeDocument | null {
  const hit = store.get(token);
  return hit && hit.profile === profile ? hit.doc : null;
}
