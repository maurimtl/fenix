# Tailoring a CV

Rules for every CV version Fenix or Claude drafts, for any person. A person's own rules (titles, currency, roles to leave out) are in `data/<person>/memory/cv-rules.md` and take precedence where they're stricter.

## Truth

- **Every number must already exist** in the person's career record or in one of their stories. Rewording may change the words around a figure, never the figure. `pnpm check:data` blocks a draft CV with a number that has no source, and `pnpm check:claims` lists them all.
- **Never add** an employer, title, date, tool or achievement that isn't in the career record. If the job asks for something the person hasn't done, leave it out; the cover note can address it.
- **A rounded or summed figure is a new number.** "90+ units" from "68 rentals and 25 units" needs its own source (add it to a story with the arithmetic), or keep the original figures.
- Opportunity sizes, forecasts and targets are not results. Don't present them as achieved.

## Fit to the job

- Pick the closest existing CV version as a starting point, then retune the headline and summary to the job's own language.
- Lead each role with the bullets that match the job. Hide old or unrelated roles before cutting bullets from relevant ones, but keep the history coherent (no unexplained gaps in the last 10 years).
- Use the job's terms where they're true: if the posting says "product-led growth" and the bullet says "self-serve growth", reword it.
- **Key achievements** (designs that show them: Plain and Executive, or any design whose `template.yaml` lists the `keyAchievements` feature): 3 short titled results, each a title of 2–5 words and one line. Pick the person's strongest backed results for this job; the number rule applies to them like any bullet. Leave them out for designs that don't print them.
- Keep it to the page count the person wants (often one page for executive roles). Check the PDF's page count after every change.

## Titles

- The career record keeps the real title. A CV may show a functional title for founder or lead roles ("Product & Engineering Lead" instead of "Co-Founder") when it describes the work truthfully, because "Co-Founder" says little about what the person did.

## Currency

- Use the currency of the employer's market. A bullet can store an alternate figure (`altText`, `altCurrency`); choose the CV's currency and Fenix prints the matching text.

## Before sending

- Read the PDF, not the editor: line breaks, page breaks and the header are what the recruiter sees.
- Save the PDF from Fenix so the CV version records exactly what was sent.
