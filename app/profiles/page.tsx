import Link from "next/link";
import { listProfiles } from "@/lib/store/profiles";
import { pagePath } from "@/lib/profile-url";
import { CreateProfileForm } from "@/components/create-profile-form";

export const dynamic = "force-dynamic";

export default async function ProfilesPage() {
  const profiles = await listProfiles();
  return (
    <main className="page profiles-page">
      <h1>Who&rsquo;s job hunting?</h1>
      {profiles.length === 0 ? (
        <p className="lede">No one yet. Add the first person below.</p>
      ) : (
        <ul className="profile-list">
          {profiles.map((p) => (
            <li key={p.slug}>
              <Link href={pagePath(p.slug, "/jobs")} className="profile-pick">
                <span className="profile-name">{p.fullName}</span>
                <span className="profile-meta">
                  {p.jobs === 1 ? "1 job" : `${p.jobs} jobs`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <CreateProfileForm />
    </main>
  );
}
