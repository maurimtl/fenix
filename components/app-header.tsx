"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
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

/** A button that opens a list of page links; closes on Escape, an outside tap, or a page change. */
function NavMenu({ label, className, groups, path, profile }: { label: string; className: string; groups: Area[][]; path: string; profile: string }) {
  // Opening records the page it was opened on, so moving to another page closes the menu.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === path;
  const setOpen = (o: boolean) => setOpenOn(o ? path : null);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  const current = groups.flat().some((a) => a.match(path));

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpenOn(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpenOn(null);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={`nav-menu ${className}`} ref={root}>
      <button
        ref={button}
        type="button"
        className="nav-menu-button"
        aria-expanded={open}
        aria-controls={id}
        data-current={current || undefined}
        onClick={() => setOpen(!open)}
      >
        {label}
        <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10">
          <path d="M1.5 3.5 5 7l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className="nav-menu-panel" id={id} hidden={!open}>
        {groups.map((g, i) => (
          <ul key={i}>
            {g.map((a) => (
              <li key={a.href}>
                <Link href={pagePath(profile, a.href)} aria-current={a.match(path) ? "page" : undefined}>
                  {a.label}
                </Link>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

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
          <div className="area-group area-daily" aria-label="Day to day" role="group">{links(DAILY)}</div>
          <span className="area-divider" aria-hidden="true" />
          <div className="area-group area-profile" aria-label="Your profile" role="group">{links(PROFILE)}</div>
          <NavMenu label="Profile" className="menu-profile" groups={[PROFILE]} path={path} profile={profile} />
        </nav>
        <span className="topbar-spacer" />
        {children}
        <Link href="/profiles" className="profile-switch" title="Switch person">
          {profile}
        </Link>
        <nav className="menu-all" aria-label="Sections">
          <NavMenu label="Menu" className="" groups={[DAILY, PROFILE]} path={path} profile={profile} />
        </nav>
      </div>
    </header>
  );
}
