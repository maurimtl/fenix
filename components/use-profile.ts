"use client";

import { useParams } from "next/navigation";

/** The profile slug of the page being viewed (every app page lives under /p/<profile>/). */
export function useProfile(): string {
  const params = useParams<{ profile?: string }>();
  if (!params.profile) throw new Error("useProfile() used outside /p/[profile]");
  return params.profile;
}
