// OpenAI Images API, called with fetch. Defaults: the one current model with a confirmed per-image price.
const DEFAULT = { model: "gpt-image-2", size: "1536x1024", quality: "medium" } as const;
// OpenAI's image-generation guide, 1536x1024 medium, image output only (checked 2026-11-09).
const DEFAULT_PRICE = "about $0.04 per background";

export function imageConfig() {
  return {
    model: process.env.OPENAI_IMAGE_MODEL || DEFAULT.model,
    size: process.env.OPENAI_IMAGE_SIZE || DEFAULT.size,
    quality: process.env.OPENAI_IMAGE_QUALITY || DEFAULT.quality,
    baseUrl: (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, ""),
  };
}

export const hasOpenAiKey = () => Boolean(process.env.OPENAI_API_KEY);

export function priceLabel(): string {
  const c = imageConfig();
  const isDefault = c.model === DEFAULT.model && c.size === DEFAULT.size && c.quality === DEFAULT.quality;
  return isDefault ? DEFAULT_PRICE : `price not known for ${c.model} ${c.size} ${c.quality}`;
}

export class ImageApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// One generation per person at a time: a second click or tab would pay twice. On globalThis so dev reloads share it.
const g = globalThis as unknown as { __fenixBannerInFlight?: Set<string> };
const inFlight = (g.__fenixBannerInFlight ??= new Set());

/** One paid image, no retries. Throws ImageApiError: 400 no key, 409 already running, 502 OpenAI failed. */
export async function generateBackground(profile: string, prompt: string): Promise<{ png: Buffer; model: string; size: string; quality: string }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new ImageApiError(400, "OPENAI_API_KEY is not set: add it to .env to generate backgrounds.");
  if (inFlight.has(profile)) throw new ImageApiError(409, "A background is already being generated.");
  inFlight.add(profile);
  const { model, size, quality, baseUrl } = imageConfig();
  try {
    const res = await fetch(`${baseUrl}/images/generations`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, prompt, size, quality, n: 1, output_format: "png" }),
      signal: AbortSignal.timeout(180_000),
    });
    const body = (await res.json().catch(() => null)) as { data?: { b64_json?: string }[]; error?: { message?: string } } | null;
    if (!res.ok) throw new ImageApiError(502, `OpenAI ${res.status}: ${(body?.error?.message ?? res.statusText).slice(0, 500)}`);
    const b64 = body?.data?.[0]?.b64_json;
    if (!b64) throw new ImageApiError(502, "OpenAI returned no image.");
    return { png: Buffer.from(b64, "base64"), model, size, quality };
  } catch (e) {
    if (e instanceof ImageApiError) throw e;
    throw new ImageApiError(502, `OpenAI request failed: ${(e as Error).message.slice(0, 300)}`);
  } finally {
    inFlight.delete(profile);
  }
}
