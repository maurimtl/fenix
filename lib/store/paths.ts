import path from "node:path";

const SLUG = /^[a-z0-9][a-z0-9-]{0,39}$/;

export function dataRoot(): string {
  return path.resolve(process.env.FENIX_DATA_DIR ?? path.join(process.cwd(), "data"));
}

export function isSlug(s: string): boolean {
  return SLUG.test(s);
}

export function assertSlug(s: string): string {
  if (!isSlug(s)) throw new StoreError("bad_slug", `invalid slug: ${JSON.stringify(s)}`);
  return s;
}

export function profileDir(profile: string): string {
  return path.join(dataRoot(), assertSlug(profile));
}

export function profilePath(profile: string, ...parts: string[]): string {
  for (const p of parts) {
    if (p.includes("/") || p.includes("\\") || p === ".." || p === ".") {
      throw new StoreError("bad_path", `invalid path segment: ${JSON.stringify(p)}`);
    }
  }
  return path.join(profileDir(profile), ...parts);
}

export function slugify(s: string, max = 60): string {
  const out = s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
  return out || "x";
}

export class StoreError extends Error {
  constructor(
    public code:
      | "bad_slug"
      | "bad_path"
      | "not_found"
      | "exists"
      | "stale"
      | "invalid"
      | "locked",
    message: string,
  ) {
    super(message);
  }
}

/** A record that's missing, fails its schema, or isn't valid YAML. Pages show these instead of failing. */
export const isUnreadable = (e: unknown) => e instanceof StoreError || (e instanceof Error && e.name === "YAMLParseError");
