import { redirect } from "next/navigation";
import { pageProfile } from "@/lib/http";
import { pagePath } from "@/lib/profile-url";

export default async function StartPage({ params }: { params: Promise<{ profile: string }> }) {
  redirect(pagePath(await pageProfile((await params).profile), "/home"));
}
