import path from "node:path";
import { listRecordFiles, parseFrontMatter, readText } from "./files";
import { isSlug, profilePath, StoreError } from "./paths";
import { describeIssues, storySchema, type StoryRecord } from "./schemas";

export type Story = { slug: string; data: StoryRecord; body: string };

async function readStory(file: string): Promise<Story | null> {
  const text = await readText(file);
  if (text === null) return null;
  const doc = parseFrontMatter(text);
  const res = storySchema.safeParse(doc.data);
  if (!res.success) throw new StoreError("invalid", `${path.basename(file)}: ${describeIssues(res.error).join("; ")}`);
  return { slug: path.basename(file, ".md"), data: res.data, body: doc.body.trim() };
}

export async function readAllStories(profile: string): Promise<Story[]> {
  const files = await listRecordFiles(profilePath(profile, "stories"), ".md");
  const stories = (await Promise.all(files.map(readStory))).filter((s): s is Story => s !== null);
  return stories.sort((a, b) => a.data.title.localeCompare(b.data.title));
}

export async function findStory(profile: string, slug: string): Promise<Story | null> {
  if (!isSlug(slug)) return null;
  return readStory(profilePath(profile, "stories", `${slug}.md`));
}
