import Link from "next/link";
import { pagePath } from "@/lib/profile-url";

export function PipelineTabs({ profile, active, filteredCount }: { profile: string; active: "board" | "filtered" | "stage"; filteredCount: number }) {
  return (
    <nav className="seg" aria-label="Pipeline views">
      <Link href={pagePath(profile, "/jobs")} aria-current={active === "board" ? "page" : undefined}>
        Board
      </Link>
      <Link href={pagePath(profile, "/jobs/filtered")} aria-current={active === "filtered" ? "page" : undefined}>
        Filtered out <span className="seg-count">{filteredCount}</span>
      </Link>
    </nav>
  );
}
