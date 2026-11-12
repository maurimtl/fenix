import { CanonicalEditor } from "@/components/canonical-editor";
import { pageProfile } from "@/lib/http";
import { readCareer, readProfileVersioned } from "@/lib/store/career";

export const dynamic = "force-dynamic";

export default async function CanonicalPage({ params }: { params: Promise<{ profile: string }> }) {
  const slug = await pageProfile((await params).profile);
  const [career, profileFile] = await Promise.all([readCareer(slug), readProfileVersioned(slug)]);
  const profile = profileFile.data;

  const data = {
    profile: {
      fullName: profile.fullName,
      headline: profile.headline,
      email: profile.email,
      phone: profile.phone ?? "",
      location: profile.location ?? "",
      summary: profile.summary,
      about: profile.about ?? "",
    },
    positions: career.data.companies.flatMap((c) =>
      c.positions.map((p) => ({
        id: p.id,
        company: c.name,
        title: p.title,
        bullets: p.bullets.map((b) => ({
          id: b.id,
          text: b.text,
          altText: b.altText ?? "",
          altCurrency: b.altCurrency ?? "",
        })),
      })),
    ),
  };

  return <CanonicalEditor data={data} versions={{ career: career.version, profile: profileFile.version }} />;
}
