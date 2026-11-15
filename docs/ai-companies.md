# Fast-growing AI companies

The AI companies the hunt checks directly on their own job boards, because their roles often never reach LinkedIn (Runway's "Member of Product Staff, Agents" was only on its Ashby board). Each line: name — what it does — board (as written in `.claude/skills/fenix-hunt/watchlist.txt`) — where the name came from.

Built 2026-11-15. Every board slug was read from the company's own careers page, or, where that page renders its board with JavaScript, confirmed by the board's postings naming the company ("confirmed by postings").

**To refresh:** look at the sources below for new names, find each careers page's board link, check the slug answers (Ashby `api.ashbyhq.com/posting-api/job-board/<slug>`, Greenhouse `boards-api.greenhouse.io/v1/boards/<slug>/jobs`, Lever `api.lever.co/v0/postings/<slug>?mode=json`), watch for name collisions (below), add a line to the watchlist and here.

**Sources:** SOTA2 "Top 100 fastest-growing AI companies" (sota2.com/top/ai-fastest-growing, updated 2026-10-27); TechCrunch, "These AI startups are growing revenue at faster and faster rates" (2026-07-08); AI Business revenue leaderboard (aibusiness.vc, November 2026); Catalora, "Fastest to $100M in 2026" (2026-11-05). "Known" means a well-known high-growth AI company named when the list was commissioned, not taken from a ranked list. Forbes AI 50 (2026, published 2026-04-16): its roster wasn't readable in search results, so nothing here is attributed to it; check forbes.com/lists/ai50 on the next refresh.

**Name collisions:** Ashby `runway` is Runway Financial (Runway the AI video company is `runway-ml`); Ashby `warp` is Warp the payroll platform (Warp the terminal is Greenhouse `warp`); Ashby `midjourney` is Midjourney, but only its medical-scanner team posts there; Ashby `sierra-jp` is Sierra's Japan board (only `sierra` is watched).

## Watched (in the watchlist)

- Runway — AI video generation, world models — `runway-ml:ashby` — known
- ElevenLabs — voice AI and voice agents — `elevenlabs:ashby` (confirmed by postings) — AI Business, Catalora
- Perplexity — AI search and agents — `perplexity:ashby` (confirmed by postings) — SOTA2
- Harvey — legal AI — `harvey:ashby` (confirmed by postings) — SOTA2
- Glean — enterprise AI search and agents — `gleanwork:greenhouse` (confirmed by postings) — TechCrunch
- Sierra — customer-service AI agents — `sierra:ashby` — TechCrunch
- Decagon — customer-service AI agents — `decagon:ashby` (confirmed by postings) — known
- Clay — AI go-to-market data platform — `claylabs:ashby` — known
- Synthesia — AI avatar video — `synthesia:ashby` (confirmed by postings) — known
- Suno — AI music generation — `suno:ashby` — known
- Abridge — clinical documentation AI — `abridge:ashby` — known
- Hebbia — AI for finance research — `hebbia-ai:ashby` — known
- Mistral AI — open and commercial LLMs, Le Chat — `mistral.ai:ashby` — SOTA2, AI Business
- Pika — AI video app — `pika:ashby` — known
- Character.AI — AI character chat — `character:ashby` — known
- Cognition — AI coding agents (Devin, Windsurf) — `cognition:ashby` — SOTA2, AI Business
- Baseten — inference platform — `baseten:ashby` — SOTA2
- Fireworks AI — inference platform — `fireworks:ashby` — SOTA2
- Together AI — AI cloud and inference — `togetherai:greenhouse` — SOTA2
- fal — generative-media inference — `fal-ai:ashby` (confirmed by postings) — SOTA2
- Mercor — expert marketplace for AI training — `mercor:ashby` — SOTA2, TechCrunch
- OpenEvidence — clinical AI search — `openevidence:ashby` (confirmed by postings) — SOTA2
- Retell AI — voice agents for calls — `retell-ai:ashby` — SOTA2
- OpenArt — AI image and video creation — `openart:ashby` — SOTA2
- AssemblyAI — speech AI API — `assemblyai:greenhouse` — SOTA2
- Databricks — data and AI platform — `databricks:greenhouse` (confirmed by postings) — AI Business
- Scale AI — AI training data — `scaleai:greenhouse` (confirmed by postings) — AI Business
- Higgsfield — AI video and image workspace — `higgsfieldai:ashby` — Catalora
- Bolt (StackBlitz) — AI app builder — `stackblitz:greenhouse` — known
- Vapi — voice agent platform — `vapi:ashby` — known
- Hex — AI data notebooks and BI — `hex:ashby` (confirmed by postings) — known
- Granola — AI meeting notes — `granola:ashby` — known
- Jasper — AI marketing content — `Jasper%20AI:ashby` — known
- Descript — AI audio and video editing — `descript:greenhouse` — known
- Captions — AI video editing — `mirage:ashby` (the company is now Mirage) — known
- HeyGen — AI avatar video — `heygen:greenhouse` (confirmed by postings) — known
- Pinecone — vector database — `pinecone:ashby` — known
- LangChain — agent framework and LangSmith — `langchain:ashby` — known
- Modal — serverless GPU compute — `modal:ashby` (confirmed by postings) — known
- Cresta — contact-center AI — `cresta:greenhouse` (confirmed by postings) — known
- Ambience Healthcare — clinical documentation AI — `ambiencehealthcare:ashby` — known
- Poolside — AI coding models — `poolside:ashby` (confirmed by postings) — known
- Reflection AI — open frontier models — `reflectionai:ashby` — Forbes AI 50 coverage (named as a 2026 newcomer)
- Thinking Machines Lab — frontier AI lab — `thinkingmachines:ashby` — known
- Factory — AI coding agents (Droids) — `factory:ashby` (confirmed by postings) — known
- Warp — agentic development environment — `warp:greenhouse` (confirmed by postings) — known
- Legora — legal AI — `legora:ashby` (confirmed by postings) — known
- Rogo — AI for finance — `rogo:ashby` — known
- Gong — revenue AI platform — `gongio:greenhouse` (confirmed by postings) — SOTA2 (not yet ranked)
- Abnormal AI — AI email security — `abnormalsecurity:greenhouse` (confirmed by postings) — SOTA2 (not yet ranked)
- Crusoe — AI cloud infrastructure — `crusoe:ashby` — SOTA2 (not yet ranked)
- Lightning AI — AI development platform — `lightningai:greenhouse` — SOTA2 (not yet ranked)
- Luma AI — AI video models — `lumaai:ashby` — known
- Black Forest Labs — image generation models — `black-forest-labs:ashby` (confirmed by postings) — known
- Ideogram — AI image generation — `ideogram:ashby` (confirmed by postings) — known
- Krea — AI creative tools — `krea:ashby` — known
- Hume AI — emotionally aware voice AI — `hume-ai:ashby` — known
- Cartesia — real-time voice models — `cartesia:ashby` — known
- Deepgram — speech AI API — `deepgram:ashby` — known
- Speak — AI language learning — `speak:ashby` — known
- Photoroom — AI photo editing — `photoroom:ashby` — known
- Relevance AI — AI agent workforce platform — `relevanceai:ashby` (confirmed by postings) — known
- n8n — AI workflow automation — `n8n:ashby` — known
- Attio — AI-native CRM — `attio:ashby` — known
- Dust — AI agents for teams — `dust:ashby` — known
- Typeface — AI marketing content — `typeface:greenhouse` (confirmed by postings) — known
- Tavus — AI video avatars — `tavus:ashby` — known
- 11x — AI sales agents — `11x:ashby` (linked from its careers page; no open roles on 2026-11-15) — known

Already watched before this list: Anthropic, OpenAI, xAI, Cursor, Cohere, Writer, Gamma, Lovable, Replit.

## Not watched (board not found or not readable)

- Clio — legal practice software with AI, Canadian — own site: clio.com/about/careers (board not found; unconfirmed)
- Ada — customer-service AI agents, Canadian — own site: ada.cx/careers (board not found; unconfirmed)
- micro1 — expert marketplace for AI training — own site: micro1.ai/careers (unconfirmed) — SOTA2
- Fathom — AI meeting notetaker — own site: fathom.ai/careers (unconfirmed) — SOTA2
- Emergent — AI app builder — own site: emergent.sh/careers (unconfirmed) — Catalora
- Hippocratic AI — healthcare AI agents — own site: hippocraticai.com/careers (unconfirmed) — known
- Augment Code — AI coding assistant — own site: augmentcode.com/careers (unconfirmed) — known
- EvenUp — AI for personal-injury law — own site: evenuplaw.com/careers (unconfirmed) — known
- Lindy — AI assistants for work — own site: lindy.ai/careers (unconfirmed) — known
- Manus — general-purpose AI agent, Singapore — own site: manus.im/careers (unconfirmed) — Catalora
- Midjourney — AI image generation — `midjourney:ashby` exists but lists only its medical-scanner team; left out — AI Business
