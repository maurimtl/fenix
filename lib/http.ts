import { notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { profileExists } from "@/lib/store/profiles";
import { StoreError } from "@/lib/store/paths";

export type ProfileParams<T = object> = { params: Promise<T & { profile: string }> };

/** For pages: the profile slug from the URL, or the 404 page when no such person exists. */
export async function pageProfile(slug: string): Promise<string> {
  if (!(await profileExists(slug))) notFound();
  return slug;
}

/** For API routes: the profile slug, or null (answer with `noProfile()`). */
export async function apiProfile(slug: string): Promise<string | null> {
  return (await profileExists(slug)) ? slug : null;
}

export const noProfile = () => NextResponse.json({ error: "no such profile" }, { status: 404 });

/** Maps store errors to HTTP answers; rethrows anything else. */
export function storeErrorResponse(e: unknown): NextResponse {
  if (e instanceof StoreError) {
    const status = { not_found: 404, exists: 409, stale: 409, invalid: 400, bad_slug: 400, bad_path: 400, locked: 503 }[e.code];
    return NextResponse.json({ error: e.message, code: e.code }, { status });
  }
  throw e;
}
