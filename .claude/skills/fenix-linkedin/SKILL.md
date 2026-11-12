---
name: fenix-linkedin
description: Use when someone wants their LinkedIn profile rewritten or improved — headline, About section, or the descriptions of their roles (or runs /fenix-linkedin). Drafts the text from their Fenix career record and stories, shows it on a Fenix page with a Copy button per section next to what is on LinkedIn now (kept in data/<p>/linkedin/profile.yaml). The person pastes it into LinkedIn; the skill never edits LinkedIn.
---

# LinkedIn (career record → proposed profile text → the person pastes it)

**Announce at start:** "I'm using the fenix-linkedin skill to draft <person>'s LinkedIn profile."

## Hard rules

- **Never edit LinkedIn.** No clicks on Edit, Save, Post or any form there. Reading the profile is allowed after the signed-in check.
- **Every number must already be in the career record or a story** (the number rule). `pnpm check:data` blocks a draft with an unbacked number.
- **Respect the person's own choices** recorded in memory (for example a location they keep on purpose).
- Limits: headline 220 characters, About 2,600, each role description 2,000 (the page counts them).

## Steps

1. **Pick the person** `<p>`. Read `data/<p>/profile.yaml`, `career.yaml`, `stories/`, `memory/MEMORY.md` with what it points to (especially `cv-rules.md` and anything about LinkedIn), `interview-answers.md` if present (the lines that landed in interviews are good About and headline material; numbers still only from the record), and `docs/cv-tailoring.md`.
2. **Current profile (optional, recommended):** load the Claude in Chrome tools in one ToolSearch call, pick this person's browser, open `https://www.linkedin.com/in/me/` and check the name shown matches `fullName`. If not, stop and say who is signed in. Read the headline, About and each role's description (open "see more" by reading the page text, not by editing). Write them to `data/<p>/linkedin/profile.yaml`, the record of what is live, replacing what was there, then `pnpm data:commit <p> "LinkedIn profile read"`:
   ```yaml
   headline: <text>
   about: |-
     <text>
   roles:
     - positionId: <id from career.yaml>
       text: |-
         <text>
   readAt: "<today, YYYY-MM-DD>"
   updatedAt: "<today>"
   ```
   Match each LinkedIn role to a `career.yaml` position; leave out a role that has no match and mention it. The live text may hold numbers the career record lacks: `pnpm check:data` counts them as warnings and `pnpm check:claims` lists them; they are for the person to confirm or add as a story, never something to hide by rewording what is live.
3. **Draft**, in the person's voice:
   - **Headline:** what they do and for whom, the target role's words first; the first ~60 characters show in search.
   - **About:** 3–5 short paragraphs or a short intro plus `- ` bullets. The first ~300 characters show before "see more", so lead with the strongest result. First person.
   - **Roles:** for each recent role (the last 10–15 years), 2–5 lines: what the team or product was, then results as `- ` bullets, drawn from that position's bullets and stories.
   Use `- ` for bullets and a blank line between paragraphs; the page's Copy button converts them to what LinkedIn keeps.
4. **Write** `data/<p>/linkedin/draft.yaml`:
   ```yaml
   generatedAt: "<now ISO>"
   headline: <text>
   about: |-
     <text>
   roles:
     - positionId: <id from career.yaml>
       text: |-
         <text>
   ```
   The draft holds only the proposal; the page compares it with `profile.yaml`.
5. **Check:** `pnpm check:data`. Fix any unbacked number or unknown position id it lists, by rewording, never by adding a source.
6. **Hand over:** point the person to `http://localhost:3007/p/<p>/linkedin`. They copy each section, paste it into LinkedIn's editor, and click "Mark as applied" so the live record follows. Mention any choice they should confirm (a title worded differently from the record, a role left out). Warn them about the LinkedIn traps below that apply to their edits.
7. **Re-read after they edit:** read the live profile again (step 2) before saying anything is done, and recheck the headline whenever a role was added.

## LinkedIn traps (learned 2026-11-09)

- **Adding a current role can overwrite the headline.** The add-position form's "update headline" option replaces it with "<title> at <company>". Tell the person to switch it off, and recheck the headline after any new role.
- **The add-position form also offers "End current position as of now"** (sets the old role's end date to this month) **and "Notify network"** (announces the role; usually off during a job search).
- **Employment type is optional.** Leave it blank rather than "Freelance".
- **Edit intro's "Organization"** is the company shown in the top card; it goes empty once the only current role ends. Leaving it empty is fine.
- **Never navigate a tab that holds an unsaved LinkedIn form**, including to "just check" another page; it discards the form. Open a new tab to read.
- **Company page editor saves one editor tab at a time**: it won't switch tabs (Page info, Buttons, Details) while one has unsaved edits. Have the person save each tab in turn.
- **Company page "My organization doesn't have a website" greys out Save** when ticked on a page that still has a URL. Save a placeholder URL first (the page's own linkedin.com/company/… address), then tick the box and save again. Also turn off the Buttons tab's "Visit website" button if it points at a dead site.
- **Skills:** pick names from LinkedIn's suggestions (standard skills match recruiter filters; invented names may not), link each to the roles where it was used, and set the up-to-5 top skills in the About editor's Skills area. Record them under `topSkills:` in `profile.yaml`.
