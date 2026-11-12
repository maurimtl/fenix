import type { Overrides } from "./schema";
import type { CanonicalData } from "./types";

// Every id an overrides object references that canonical doesn't have, as "kind:id".
export function unknownIds(o: Overrides, c: CanonicalData): string[] {
  const positions = new Map(c.positions.map((p) => [p.id, new Set(p.bullets.map((b) => b.id))]));
  const skills = new Set(c.skills.map((s) => s.id));
  const courses = new Set(c.courses.map((x) => x.id));
  const education = new Set(c.education.map((e) => e.id));
  const bad: string[] = [];
  const check = (ids: string[] | undefined, known: Set<string>, kind: string) =>
    ids?.forEach((id) => known.has(id) || bad.push(`${kind}:${id}`));

  check(o.skillIds, skills, "skill");
  check(o.courseIds, courses, "course");
  check(o.educationDateIds, education, "education");
  check(o.hiddenPositionIds, new Set(positions.keys()), "position");
  check(o.positionOrder, new Set(positions.keys()), "position");
  for (const [pid, po] of Object.entries(o.positions)) {
    const bullets = positions.get(pid);
    if (!bullets) {
      bad.push(`position:${pid}`);
      continue;
    }
    check(po.includedBulletIds, bullets, "bullet");
    check(Object.keys(po.bullets), bullets, "bullet");
  }
  return bad;
}
