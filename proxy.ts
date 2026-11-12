import { NextResponse, type NextRequest } from "next/server";
import { listProfileSlugs, profileExists } from "@/lib/store/profiles";
import { isSlug } from "@/lib/store/paths";
import { PROFILE_COOKIE } from "@/lib/profile-url";
import { localHost, sameOrigin } from "@/lib/same-origin";

async function lastUsed(req: NextRequest): Promise<string | null> {
  const c = req.cookies.get(PROFILE_COOKIE)?.value;
  if (c && (await profileExists(c))) return c;
  const all = await listProfileSlugs();
  return all.length === 1 ? all[0] : null;
}

const READS = new Set(["GET", "HEAD", "OPTIONS"]);
const OLD_PATHS = /^\/$|^\/(jobs|variants|canonical|cv)(\/|$)/;

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (!localHost(req)) return new NextResponse("Fenix only answers on localhost", { status: 403 });

  // The app has no login, so any website open in the browser could send requests here: every API request that
  // changes something must come from Fenix's own pages (or a local tool, which sends no Origin).
  if (pathname.startsWith("/api/")) {
    if (READS.has(req.method) || sameOrigin(req)) return NextResponse.next();
    return NextResponse.json({ error: "this request must come from a Fenix page" }, { status: 403 });
  }

  if (pathname.startsWith("/p/")) {
    const slug = pathname.split("/")[2] ?? "";
    const res = NextResponse.next();
    if (isSlug(slug) && req.cookies.get(PROFILE_COOKIE)?.value !== slug) {
      res.cookies.set(PROFILE_COOKIE, slug, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
    }
    return res;
  }

  if (!OLD_PATHS.test(pathname)) return NextResponse.next();

  const profile = await lastUsed(req);
  const rest = pathname === "/" ? "/home" : pathname;
  const to = profile ? `/p/${profile}${rest}${search}` : "/profiles";
  return NextResponse.redirect(new URL(to, req.url), 302);
}

export const config = {
  // Every page and API request gets the local-Host check; API writes also the same-origin check; old pre-profile
  // paths redirect; /p/* refreshes the last-used cookie.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
