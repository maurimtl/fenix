---
name: fenix-onboard
description: Use when someone new wants to start using Fenix, or asks to set up a profile for a person (or runs /fenix-onboard). Creates their profile, turns their CV PDF, LinkedIn export or LinkedIn profile into a career record, asks the settings questions (pay floor, where they can work, target roles), and interviews them for a few career stories. Never invents experience or numbers.
---

# Onboard (new person → profile, career record, settings, first stories)

**Announce at start:** "I'm using the fenix-onboard skill to set up Fenix for <name>."

## Hard rules

- **Only what the source says.** Every employer, title, date, bullet, degree and number comes from the person's CV, LinkedIn export or their own words. If something is unclear (a date, a merged role), ask.
- **Writes go through `pnpm fenix`** (validated, locked, committed to `data/`), never by hand-editing `career.yaml` or `profile.yaml`.
- **Their data stays local.** Don't paste it into web tools.

## Steps

1. **Create the profile:** `pnpm fenix create-profile "<Full Name>"` prints the folder name, `<p>`. (In the browser, the Profiles page does the same.) If it says the profile exists, ask whether to continue with that one.
2. **Get the source.** Ask for one of:
   - a CV PDF: read it with `pdftotext -layout <file> -` (and look at page 1 as an image if the layout is unclear);
   - a LinkedIn data export (Settings → Data privacy → Get a copy of your data): `Positions.csv`, `Education.csv`, `Skills.csv`, `Profile.csv`;
   - a LinkedIn profile link: load the Claude in Chrome tools in one ToolSearch call (`tabs_context_mcp, tabs_create_mcp, navigate, get_page_text, find`), pick this person's browser, open `https://www.linkedin.com/in/me/` in a new tab and check the name shown matches the profile's `fullName`; if it doesn't, stop and say who is signed in. Then read `<profile link>/details/experience/`, `/details/education/` and `/details/skills/` with `get_page_text` (each is the full "see all" list; scroll and read again until the list stops growing). Read only: never click Edit, Save or any form (see `docs/learnings/linkedin.md`). LinkedIn shows months, not days: a month-only date uses day 01. A role grouped under one company with several titles is one position per title;
   - or a CV plus LinkedIn, with the CV winning on bullets and LinkedIn on dates.
   Tell the person what each source gave: LinkedIn often has no bullets for older roles, so offer to fill them from the CV or in their own words.
3. **Write the career record** to `.scratch/onboard-<p>/career.yaml` in this shape, then import it:
   ```yaml
   companies:
     - id: <company-slug>
       name: <Company>
       positions:
         - id: <company-slug>-<title-slug>
           title: <Title>
           location: <City> or null
           startDate: "YYYY-MM-01"
           endDate: "YYYY-MM-01" or null for current
           bullets:
             - id: <position-id>-1
               text: <the bullet, as written>
   education: [{ id, degree, institution, location, startYear, endYear }]
   skills: [{ id, name }]
   courses: [{ id, name, term, provider }]
   ```
   Ids are short, lowercase and stable; CV versions refer to them. A month-only date uses day 01. Then `pnpm fenix import-career <p> .scratch/onboard-<p>/career.yaml`. It prints what it imported or exactly what's invalid.
4. **Profile and settings.** Ask, in one message, numbered:
   1. headline and summary (offer the ones from the CV);
   2. email, phone, city, LinkedIn URL;
   3. minimum base pay in USD (`floorUsd`);
   4. country they live in, and where they can work: remote rule in plain words, any visa or relocation exceptions;
   5. target titles, and 3–5 job searches as "location, time window: keywords";
   6. how CV files should be named (default `{name} - {company} - {role}`);
   7. where their CV PDFs should go, so they're easy to grab (a folder such as `~/Documents/CVs`; optional).
   Write the answers to `.scratch/onboard-<p>/profile.yaml` (`headline`, `summary`, `email`, `phone`, `location`, `linkedin`, `settings: { floorUsd, homeCountry, homeCountryName, remoteRule, exceptions, targetTitles, queries, cvFileName, cvFolder }`; `cvFolder` as a full path, `~` written out as the home folder) and run `pnpm fenix set-profile <p> .scratch/onboard-<p>/profile.yaml`.
5. **Check:** `pnpm check:data` passes, and the default CV prints: `curl -s -o .scratch/onboard-<p>/cv.pdf localhost:3007/api/p/<p>/cv/base/pdf` (Fenix must be running; ask the person to start it if not). Show page 1, and compare the jobs and dates with their source.
6. **Stories.** Offer the story interview (the fenix-stories skill) for their 2–3 proudest results. Stories are where numbers get their context and proof.
7. **Memory.** Write what you learned that isn't in the record (preferences, constraints, what they want next) as files in `data/<p>/memory/`, each with `name` and `description` front matter, listed in `memory/MEMORY.md`. Include a `hunt-profile.md` with their LinkedIn location id and job boards for their country, and a `cv-rules.md` for their own tailoring rules (see `docs/cv-tailoring.md`). Run `pnpm check:data`.
8. **Design (optional):** if they have a CV design they like, offer the fenix-template skill.
9. **Tell them** where things are: `http://localhost:3007/p/<p>/canonical` (career record), `/p/<p>/variants` (CVs), `/p/<p>/jobs` (pipeline), and that their data is in `data/<p>/`, backed up by `pnpm backup` once `data/` has a private remote.
