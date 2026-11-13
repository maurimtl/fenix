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

## Easy Apply: résumé upload has no file input until clicked

The dialog is a `<dialog open>` element; "Upload resume" creates its `input[type=file]` only on click and opens the OS picker. Before clicking, override `HTMLInputElement.prototype.click` so a file input appends itself to the dialog (with an `aria-label`) and returns without opening the picker; then `find` that label and use `file_upload` on it. The page shows "Resume uploaded successfully" and selects the new file.

## Easy Apply: typed text can drop characters

Typing a long message into the top-choice textarea with `computer type` lost letters ("workflws", "ira"). Set long text with `form_input` and read the value back. Ticking "Mark job as a top choice" makes a 20–400 character message required.

## Search page: no date sort, but paging, a 24-hour filter and an applicant filter work

Tested on `/jobs/search-results/` on 2026-11-13:
- `sortBy=DD` is dropped from the address and the cards stay in relevance order. There is no newest-first sort.
- `f_TPR=r86400` limits results to the past 24 hours (all 25 cards were under a day old).
- `start=25`, `start=50`, … page through results, 25 cards a page; the page shows "Page 1 / 2 / 3" controls.
- `f_EA=true` is the "Under 10 applicants" filter and stays in the address.
- Each card prints its age ("Posted 18 hours ago", "Posted 2 weeks ago", "Reposted 1 day ago"); some promoted cards print none.
- The age is not reliable for reposts: Pacvue's "Reposted 1 day ago" role was first published on its Greenhouse board five weeks earlier. The company board's date is the one to trust.

## Posts search takes the date filter and the sort in the address

`/search/results/content/?keywords=<q>&datePosted="past-24h"&sortBy="date_posted"` (the quotes are part of the values) lists posts newest first; the page reorders the parameters but keeps them (tested 2026-11-13). Six posts load before scrolling. A search for "hiring" plus "head of product" returned posts from 2 minutes to 2 hours old, and one in six was a real opening; the rest were people announcing their own new job, newsletters and recruiters' lists. Links in posts are `lnkd.in` short links that redirect to the company's posting.

Scrolling the results page did not load more than the first 6 to 12 posts, and the page's HTML carries no post address (no `urn:li:activity` ids), so a post can be identified by its author and opening words but not linked without opening its menu.

`javascript_tool` returns "[BLOCKED: Cookie/query string data]" when the result contains a full address with a query string, such as `location.href` on this page. Return the text, hosts or paths instead.
