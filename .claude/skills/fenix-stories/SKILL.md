---
name: fenix-stories
description: Use when someone wants to record the story behind a career result, prepare examples for interviews, or back up a number on their CV (or runs /fenix-stories). Interviews them one story at a time and saves each as a story file with its numbers and where each number comes from. Never invents numbers.
---

# Stories (interview → data/<p>/stories/<slug>.md)

**Announce at start:** "I'm using the fenix-stories skill to capture a career story with <person>."

A story is the context behind a result: the situation, what the person did, what changed, and the numbers with their proof. Stories feed CV tailoring, application answers and interview prep, and they are one of the two places a CV number may come from (the other is the career record).

## Steps

1. **Pick the person** `<p>` and read `data/<p>/career.yaml`, `data/<p>/stories/` (don't duplicate) and their memory index.
2. **Pick the story.** Suggest 2–3 candidates from their strongest bullets, or take the one they name.
3. **Interview**, a few questions at a time, in their words:
   - What was the situation, and why did it matter?
   - What did *you* decide or build? Who else was involved?
   - What changed, and how do you know? For each number: what exactly was measured, over what period, and where it's recorded (a dashboard, a report, a review).
   - What would you do differently?
4. **Write** `data/<p>/stories/<slug>.md`:
   ```markdown
   ---
   title: <one line, what happened>
   company: <Company>
   role: <title then>
   period: "<when>"
   themes: [<2-4 words like activation, pricing, hiring>]
   numbers:
     - claim: <the number as it will appear, e.g. trial-to-paid from 9% to 13%>
       proof: <a career bullet id, or where the figure is recorded>
   usedIn: []
   ---
   <2-4 short paragraphs in plain words: situation, what they did, result.>
   ```
   Quote `period` (a bare year is read as a number). A number the person isn't sure of stays out of `numbers`; say so in the text instead.
5. **Link** a bullet to the story when one matches: set `story: <slug>` on that bullet with the career record editor or `pnpm fenix import-career` (never by hand).
6. **Check:** `pnpm check:data`, then show it at `http://localhost:3007/p/<p>/stories/<slug>`.
