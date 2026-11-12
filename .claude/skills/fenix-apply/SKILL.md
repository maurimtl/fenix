---
name: fenix-apply
description: Use when someone asks to apply to a job saved in their Fenix pipeline (or runs /fenix-apply). Saves the CV PDF, pre-checks every question on the company's application form with proposed answers (reusing their answer bank), fills the form in their signed-in Chrome after they approve, records the answers, and stops before Submit. Never submits, never types passwords.
---

# Apply (Fenix job → filled application form, stopped before Submit)

**Announce at start:** "I'm using the fenix-apply skill to prepare the <Company> application for <person>."

## Who and what

- One Fenix profile, `<p>` (a folder in `data/`), and one job in it (`/p/<p>/jobs/<id>`). With one profile it's that one; otherwise use the person the request names, or ask.
- Read first: `data/<p>/profile.yaml` (`fullName`, `settings.remoteRule`, `settings.exceptions`), `data/<p>/memory/MEMORY.md` and the memories it points to (preferences for applications, relocation, work authorization), `docs/cv-tailoring.md` and the person's `cv-rules.md`.

## Hard rules

- **Never click Submit** (or Send, Apply, Confirm). The person submits.
- **Never type a password, passcode or account credential**, and never create an account. If the form needs a sign-in, stop and ask the person to sign in.
- **Never tick a consent, acknowledgement, background-check or legal attestation box.** Those are the person's.
- **Never invent** pay expectations, dates, work authorization, or achievements. Answers come from the answer bank, the person's files, or the person.
- **Voluntary demographic questions** (gender, race, veteran, disability, pronouns) are left for the person unless they gave an answer to reuse.
- **Verify the domain**: the form must be on the company's site or its applicant system (Greenhouse, Lever, Ashby, Workday, LinkedIn Easy Apply). Don't fill a form reached from an aggregator's redirect without checking where it lands.

## Steps

1. **Fenix is up:** `curl -s -o /dev/null -w '%{http_code}' http://localhost:3007/p/<p>/jobs/<id>` → `200`. If not, ask the person to start it; don't start it yourself.
2. **The job and its CV:** the job's file is `grep -l '^id: <id>$' data/<p>/jobs/*.md`. Its front matter has the posting `url`, the linked `cv` id and any saved `answers`. No CV yet: draft one as in the fenix-hunt skill's "CV drafting" section, and run `pnpm check:claims <p>` (no `BLOCKS` lines).
3. **Save the PDF to send:** `curl -s -X POST localhost:3007/api/p/<p>/cvs/<cvId>/save-pdf` → `{ pdf, bytes, folderWarning }`. The file is in `data/<p>/cvs/<pdf>`, and a copy is in their CV folder when one is set; if `folderWarning` isn't null, tell them the copy failed and why. Open it and check the page count and first page before uploading.
4. **Browser and person:** load the Claude in Chrome tools in one ToolSearch call (`tabs_context_mcp, tabs_create_mcp, navigate, get_page_text, find, read_page, form_input, computer, file_upload, javascript_tool`). If several browsers are connected (one per Chrome profile), pick this person's. Open `https://www.linkedin.com/feed/` and read the signed-in member's name; if it isn't `fullName`, stop and say who is signed in. Then open the application form in a new tab.
5. **Pre-check (nothing typed yet):** list every field and question on the form, including later pages if they can be reached without submitting. For each, propose an answer:
   - Reuse the answer bank first: `curl -s "localhost:3007/api/p/<p>/answers?q=<keyword>"` for each question's key words.
   - Otherwise draft from the career record, stories and memory. Mark drafts as new.
   - Mark what only the person can answer (pay expectations if not in their files, start date, consent boxes, demographics).
   Show the list as one message and wait for the person's OK or edits.
6. **Fill:** after the OK, fill every approved field without asking again per step. Upload the PDF from step 3 to the résumé field and check the file name it shows (some forms have a separate cover-letter upload next to it). Set visible controls only, and read each value back. Stop at the Submit button.
7. **Record:** `PUT /api/p/<p>/jobs/<id>/answers` with `{"answers":[{"question":"…","answer":"…"}]}` for every question answered, including the approved new ones. Leave out the person's email address and phone number.
8. **Hand over:** tell the person what's filled, what's left for them (consents, demographics, anything unanswered), and that the tab is ready for Submit. Leave the tab open.
9. **After they submit:** when the person says they submitted, `PATCH /api/p/<p>/jobs/<id>` with `{"stage":"APPLIED"}`.

## When something goes wrong

- Captcha, sign-in wall, or "unusual activity": stop and tell the person. Don't retry.
- The tab leaves Claude's tab group: open the form again in a new tab and tell the person which old tab to close (see `docs/learnings/claude-in-chrome.md`).
- The posting is closed: `PATCH /api/p/<p>/jobs/<id>` with `{"postingClosedAt":"<now ISO>","postingClosedEvidence":"<the page's words>"}` and tell the person.
