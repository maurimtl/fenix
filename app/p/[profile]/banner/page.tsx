import { BannerEditor } from "@/components/banner-editor";
import { pageProfile } from "@/lib/http";
import { readBanner } from "@/lib/store/banner";
import { hasOpenAiKey, priceLabel } from "@/lib/banner/openai";
import { promptWho } from "@/lib/start/progress";
import { prompts } from "@/lib/start/prompts";

export const dynamic = "force-dynamic";

export default async function BannerPage({ params }: { params: Promise<{ profile: string }> }) {
  const slug = await pageProfile((await params).profile);
  const [{ data, version }, who] = await Promise.all([readBanner(slug), promptWho(slug)]);
  return <BannerEditor initial={data} initialVersion={version} hasKey={hasOpenAiKey()} price={priceLabel()} prompt={prompts.banner(who)} />;
}
