# LinkedIn

## Job search moved to `/jobs/search-results/` (Nov 2026)

`/jobs/search/` redirects to `/jobs/search-results/` and drops the `location`, `f_WT` (remote) and `f_E` (experience) parameters. Use the new page directly with `keywords`, `geoId` and `f_TPR`:

`https://www.linkedin.com/jobs/search-results/?keywords=<q>&geoId=<geo>&f_TPR=r604800`

- Without a `geoId`, the page reuses the last location searched. Canada is `101174742`.
- The remote filter doesn't stick, so on-site and hybrid roles appear. Read the work arrangement in every posting.
- Natural-language keywords work, but adding "Canada" to a US search is mostly ignored: it doesn't surface "US or Canada" postings. Search from the Canada location instead.

## Result cards have no job links

The job id is the 10-digit number inside each card's `componentkey` attribute (`div[role=button][componentkey]`). Wait about 4 seconds after navigating before reading them.

## Profile editors won't switch tabs with unsaved edits

On a company page or profile editor with several tabs, LinkedIn keeps you on the current tab until its edits are saved. Save each tab before moving to the next.
