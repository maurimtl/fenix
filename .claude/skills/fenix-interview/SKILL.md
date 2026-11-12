---
name: fenix-interview
description: Use when someone wants a brief before a job interview, or a review of an interview they just had (from a Fellow or Wispr recording, a pasted transcript or a file), or asks how they answered and what to say next time (or runs /fenix-interview). Writes one file per round in data/<p>/interviews/, keeps their best answers in interview-answers.md, flags numbers that differ from their record, and proposes new stories. Never contacts the interviewer.
---

# Interview (brief before a round, review after it)

**Announce at start:** "I'm using the fenix-interview skill to <brief you for / review> your <company> round <n>."

Each round is one file, `data/<p>/interviews/<YYYY-MM-DD>-<company-slug>-r<round>.md`: `## Brief` is written before the round, `## Review` after it. The raw transcript sits next to it as `<same name>.transcript.txt`. The person's best answer per common question lives in `data/<p>/interview-answers.md`. Everything stays in their private data folder.

## Hard rules

- **Numbers come from the record.** Every number in a brief's "Numbers to use" (and its `numbers:` front matter) must be in `career.yaml` or a story. `pnpm check:data` blocks one that isn't. A number the person *said* in an interview is not proof: if it's new, propose a story and ask where it's recorded before it can go on a CV.
- **Mark what you couldn't confirm** about the company or the people, and say where you looked.
- **Never contact anyone.** No emails, messages or LinkedIn actions to the interviewer or the company.
- **One person at a time.** Read and write only `<p>`'s files (see CLAUDE.md).

## Front matter

```yaml
---
job: <job id from data/<p>/jobs/*.md>
company: <Company>
round: <1, 2, …>
date: "<YYYY-MM-DD>"
status: brief        # or reviewed, once the review is written
with:
  - name: <interviewer>
    role: <their title, if known>
transcript:          # only once a transcript file exists
  source: fellow     # fellow | wispr | file | pasted
  ref: <meeting id or file path, optional>
numbers:             # the brief's numbers to use, as phrased there
  - trial activation +56%
---
```

## Brief ("brief me for my <company> round <n>")

1. **Pick the person** `<p>` and the job: find it in `data/<p>/jobs/` by company. Read its `notes`, the posting, and every earlier round for that job in `data/<p>/interviews/` (what they were already told). Read `interview-answers.md`, `career.yaml`, `stories/`, `memory/MEMORY.md` with `cv-rules.md`, and `docs/cv-tailoring.md`.
2. **Research** the company and each interviewer with WebSearch, Exa and Tavily (not keyword search alone): what they sell, size and funding, recent news, the interviewers' backgrounds, and anything a candidate should know before accepting (legal or regulator matters, layoffs, reviews). Link every source. Say what you couldn't confirm.
3. **Write `## Brief`** in this order, plain and short:
   - read this first (only if something serious turned up);
   - the company, and the people in this round;
   - what you told them before (from earlier rounds' reviews): stay consistent;
   - numbers to use, each from the record or a story (also listed in `numbers:`);
   - likely questions, with the angle from `interview-answers.md`;
   - questions to ask them;
   - the company's stated interview rules (for example "no AI tools during interviews").
4. Set `status: brief`. Run `pnpm check:data`, then `pnpm data:commit <p> "interview brief <company> r<n>"`. Show `http://localhost:3007/p/<p>/interviews/<slug>`.

## Review ("review my interview with <company>")

1. **Get the transcript**, in this order:
   - Fellow connector: `search_meetings` for the date and company, then `get_meeting_transcript`;
   - Wispr Flow connector: `search_meetings`, then `get_meeting`;
   - otherwise ask the person to paste it or give a file path (`.txt`, `.vtt`, `.srt`, `.docx` via `pandoc`). Fenix doesn't record or transcribe audio.
   Save it as `<slug>.transcript.txt` and set `transcript:` in the front matter. If the round file doesn't exist yet, create it with the front matter above.
2. **Write `## Review`:**
   - **What they said:** the role, team, pay and terms, process and next steps.
   - **Your answers:** each question, a short summary of the answer, **keep** or **rework**, and how to say it next time in the person's own voice.
   - **Numbers you said:** each one checked against the record and stories: matches, or differs (give the recorded figure to use instead).
   - **Follow-ups:** what was promised, and anything to raise next round.
   Set `status: reviewed`.
3. **Re-review:** if the round already has a review, show the person what would change and replace the `## Review` section and the transcript only after they agree.
4. **Update `interview-answers.md`** (create it with `name: interview-answers`, a `description`, and `landed: []` if missing): one section per common question with the best current answer, updated in place, never duplicated. Add lines that clearly landed to `landed:` (each under 300 characters, numbers only from the record).
5. **New results:** for a result the person described that isn't in the record, propose a story (the fenix-stories format). Write it only after they confirm the numbers and where each is recorded.
6. **Memory:** if the round changed where the application stands (next round booked, an offer, a rejection), update that job's memory file in `data/<p>/memory/` and, through the app, its stage (`PATCH /api/p/<p>/jobs/<id>` with `stage`).
7. Run `pnpm check:data`, then `pnpm data:commit <p> "interview review <company> r<n>"`. Show the round page.

Two sessions editing the same round at once is last-write-wins, as with memory and stories; don't review a round in two sessions.
