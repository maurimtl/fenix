---
name: fenix-template
description: Use when someone wants their CVs in a particular design, has a screenshot or PDF of a CV layout they like, or wants to adjust their CV template (or runs /fenix-template). Builds a Liquid template in data/<p>/templates/ from the image, renders it with their own data, compares side by side for at most 5 rounds, then takes their tweaks.
---

# Template (screenshot → data/<p>/templates/<id>/)

**Announce at start:** "I'm using the fenix-template skill to build a CV design for <person>."

## What a template is

A folder `data/<p>/templates/<id>/` with:
- `template.yaml`: `name`, `description`, and optional `features: [keyAchievements]` when the design prints Key achievements (the CV editor then stops saying "Not shown by <design>").
- `template.liquid`: the HTML body, in Liquid. Other `.liquid` files in the folder can be included by full file name: `{% render 'header.liquid', name: fullName %}` (a rendered file sees only what you pass it).
- `style.css`: plain CSS, never run through Liquid. Use `@page { size: Letter; margin: … }` for print margins.

The built-ins in `templates/` (plain, classic, executive, gutter, sidebar, compact) are working examples to start from. Executive shows page-margin boxes (the name and page number from page 2) and Key achievements.

**Variables** (all present; optional ones are `null`): `fullName`, `fullNameCss` (the name escaped for a CSS string such as an `@page` margin box), `headline`, `email`, `phone`, `location`, `linkedin`, `linkedinLabel`, `linkedinPrefix` and `linkedinHandle` (the label in two parts, so it can wrap between them and never inside the handle), `summary`, `summaryLines`, `summaryIsList`, `positions` (each: `title`, `company`, `location`, `start`, `end`, `dates`, `bullets` with `text`), `education` (`degree`, `institution`, `location`, `years`), `skills` (`name`), `skillsHeading`, `courseGroups` (`provider`, `items` with `name`, `term`), `languages`, `languagesText`, `contactInSidebar`, `educationInSidebar`, `compactSidebar`, `keyAchievements` (each: `title`, `text`; empty unless the CV version has some).

**Limits, enforced by Fenix:** every value is HTML-escaped; a misspelled variable or filter is an error naming it; no scripts run (the print page sends `script-src 'none'`); no outside fonts, images or links load (only inline styles and `data:` images); a render is stopped after about 5 seconds. Use font stacks of system fonts.

**So application systems read it:** no `letter-spacing` on headings (extractors read `S U M M A R Y`), `font-variant-ligatures: none`, dates in the same line or block as their job rather than right-aligned in a separate column, and in a two-column design the main column first in the HTML. `pnpm check:templates --report <p> <id>` lists what the extractors get wrong.

## Steps

1. **Pick the person** `<p>` and get the design: a screenshot, or a PDF (render page 1: `pdftoppm -r 70 -f 1 -l 1 -png -singlefile <file> .scratch/template-<p>/ref`). Look at it.
2. **Write** the three files under `data/<p>/templates/<id>/` (`<id>`: short, lowercase, dashes). Match layout first (columns, header, section order), then type (sizes, weights, case), then colour.
3. **Render with their data:** point a CV at it (the editor's Design menu, or `settings.defaultTemplate` via `pnpm fenix set-profile`), then `curl -s -o .scratch/template-<p>/try.pdf localhost:3007/api/p/<p>/cv/base/pdf`. An error response names the template problem.
4. **Compare:** `pdftoppm -r 70 -f 1 -l 1 -png -singlefile .scratch/template-<p>/try.pdf .scratch/template-<p>/try` and `magick .scratch/template-<p>/ref.png .scratch/template-<p>/try.png +append .scratch/template-<p>/compare.png`; look at it and list the differences that matter.
5. **Repeat 2–4 at most 5 times.** Stop earlier when the remaining differences are only the content. Then show the person the comparison and take their tweaks.
6. **Check:** `pnpm check:templates` passes, `pnpm check:templates --report <p> <id>` shows no issues (or the person accepts the ones left), the page count is what they want (`pdfinfo … | grep Pages`), and `curl -s localhost:3007/api/p/<p>/templates` lists it. It's only listed for this person.
