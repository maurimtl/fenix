"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProfile } from "@/components/use-profile";
import { pagePath } from "@/lib/profile-url";


type Area = { href: string; label: string; match: (p: string) => boolean };
const area = (href: string, label: string, ...also: string[]): Area => ({
  href,
  label,
  match: (p) => [href, ...also].some((h) => p === h || p.startsWith(`${h}/`)),
});

/** Day-to-day pages first; the pages that describe the person, and change rarely, after the divider. */
const DAILY: Area[] = [area("/home", "Home"), area("/jobs", "Pipeline"), area("/interviews", "Interviews"), area("/variants", "CVs", "/cv")];
const PROFILE: Area[] = [
  area("/canonical", "Career record"),
  area("/stories", "Stories"),
  area("/designs", "Designs"),
  area("/linkedin", "LinkedIn"),
  area("/banner", "Banner"),
];

/** The part of the path after /p/<profile>. */
const local = (path: string, profile: string) => path.slice(`/p/${profile}`.length) || "/";

export function AppHeader({ children }: { children?: React.ReactNode }) {
  const profile = useProfile();
  const path = local(usePathname(), profile);
  const links = (areas: Area[]) =>
    areas.map((a) => (
      <Link key={a.href} href={pagePath(profile, a.href)} aria-current={a.match(path) ? "page" : undefined}>
        {a.label}
      </Link>
    ));
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href={pagePath(profile, "/home")} className="wordmark">
          Fenix
        </Link>
        <nav className="areas" aria-label="Sections">
          <div className="area-group" aria-label="Day to day" role="group">{links(DAILY)}</div>
          <span className="area-divider" aria-hidden="true" />
          <div className="area-group" aria-label="Your profile" role="group">{links(PROFILE)}</div>
        </nav>
        <span className="topbar-spacer" />
        {children}
        <Link href="/profiles" className="profile-switch" title="Switch person">
          {profile}
        </Link>
      </div>
    </header>
  );
}
