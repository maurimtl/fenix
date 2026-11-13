# Job boards and application forms

## The watchlist title filter must include "SVP"

`boards.py` once matched titles with `vp` but not `svp`, so senior-VP roles only showed up through LinkedIn. The filter is `\b(director|head|s?vp|evp|vice president|chief|gm|general manager)\b.*\b(product|growth|ai)\b`. When a role surfaces on LinkedIn that the watchlist should have caught, check this filter first.

## Lenny's Jobs filters aren't in the URL

Set Job category, Level and Location by clicking each time. Cards don't link to the posting; find the role on the company's own board.

## Greenhouse: the second Attach button is the cover letter

On Greenhouse forms, the résumé and the cover letter each have an Attach button. Upload the CV to the résumé field and check the file name shown under it. (Noted in an earlier session; not re-verified since.)

## Greenhouse: typing can double the text

On some Greenhouse fields (seen on the Upsun embed, 2026-11-10), typing with the computer tool entered the text twice. Set text with `form_input` instead, then read the value back.

## iCIMS: sign-in lives in the emailed link, and the form is in a frame

On iCIMS (Avalara, 2026-11-10), the sign-in is tied to the link the person opens, not to a browser cookie: a fresh tab to the same job lands on the email and consent page again. Work in the tab they signed in on. The form sits in `iframe#icims_content_iframe` (same origin): read and fill it through `contentDocument`, but `find`, `read_page` and `file_upload` can't reach inside, so the person attaches the CV. Uploading a CV there overwrites fields already typed, so it goes first. Country and State/Province are search widgets whose options load on click: open them and pick by clicking.

- **Sparc (2026-11-09):** `sparcwork.com/roles/vp-product` is now a stats page (counts by country and city, top tools) with no job listings unless you upload a CV. Nothing to save from it.
- **remote100k (2026-11-09):** the product list is at `/remote-jobs/product`; each card gives company, age, posted pay and a `Remote:` country flag line, so Canada roles can be read off the list without opening them.

- **Lenny's Jobs (2026-11-10):** with Product Management, Canada and Director/VP/SVP levels set, the list shows about 16 cards and then 12 "Members Only" cards that need a sign-in. Typing "Canada" in Location can briefly reorder the options, so take a screenshot before clicking (a blind click picked Quebec City).
- **Codility (2026-11-10):** postings live on HiBob (`codility.careers.hibob.com/jobs/<id>`), rendered in a shadow DOM: `get_page_text` returns nothing, so walk the shadow roots in `javascript_tool` to read the text.

## HiBob: set fields with script, upload through the dialog

On Codility's HiBob form (2026-11-11), clicking a text field let another extension take over the tab: typing and screenshots failed with "Cannot access a chrome-extension:// URL of different extension" until the page was reloaded. Set text fields by walking the shadow roots and calling the native `value` setter plus `input`/`change` events, then read them back. Dropdowns and radios take normal clicks. "Add file" opens an "Add document" dialog; `find` locates its file input, `file_upload` works there, then click Done.

## Greenhouse: the API question list can miss sections

The `?questions=true` API doesn't list Greenhouse's Employment and Education sections; Motive's form (2026-11-11) required both. HEC Montréal is not in Greenhouse's school list, so use Concordia University (Bachelor's Degree, 2004). Set the phone country before the phone number, or the number is dropped.

## Supabase caps applications

Supabase's Ashby form allows 3 applications per person in 60 days (seen 2026-11-11).

## Teradata (careers.teradata.com): the résumé parser scrambles the profile

Teradata's careers site makes you create a profile (email plus a privacy box, the person's step), then parses the uploaded CV into Personal, Employment, Education and Skills steps before the questions. On 2026-11-11 the parser put "Fractional" as the employer, marked a past job as current, attached a title to the wrong company, set Quebec addresses to "Badakhshan" and added a duplicate education entry. Check every entry. The month/year date boxes ignore typed text; use the calendar button (year, then month). Removing an entry asks for a Delete confirmation, which is the person's click. Skills is optional.

## Jobgether on LinkedIn hides the hiring company

Jobgether reposts other companies' roles on LinkedIn as "on behalf of a partner company", with the company name removed and Jobgether handling the application. On 2026-11-12 its "Senior Director, Product Growth" (Canada, $250–300K) was Roofr's own posting word for word, and Roofr was already in the pipeline as Applied. Before saving a Jobgether role, search a distinctive phrase or pay band from it to find the real company, then dedupe and apply through that company's board.

Ladders does the same ("For our client, we are seeking…", a shortened description with the original pay band and benefits list). On 2026-11-13 its "VP, Horizontal AI Product (Remote)" was CrowdStrike requisition R30807 (Workday) and its "Senior Director, Product Growth" was Hello Heart's Greenhouse posting. Searching the exact title plus the pay band finds the original; save the role under the real company, not as a second row.

## iCIMS: attaching the CV inside the frame

`file_upload` and `find` can't see into `iframe#icims_content_iframe`, and loading the frame's own URL as the page just re-wraps it. On Kinaxis (2026-11-13) this worked instead: serve the one PDF from a throwaway local server on `127.0.0.1` (CORS allowed for the iCIMS origin only, plus `Access-Control-Allow-Private-Network: true`), then in `javascript_tool` use the frame's own `fetch`, `File` and `DataTransfer` to set `input[type=file].files` and dispatch `change`. The page reloads with the file name shown and fills name, phone and address from the CV. Stop the server straight after. Do it before typing anything, since the upload overwrites fields.

## Which job sources a script can read (tested 2026-11-13)

`scan.py` reads these without a browser. The exact requests are in `hunt_ats.py` and `hunt_feeds.py`; the quirks worth knowing:

- **Himalayas** (`himalayas.app/jobs/api/search?q=…&country=CA&seniority=Director`): `country` keeps roles that list the country plus roles open worldwide. `seniority` takes `Director` or `Executive`, one per request. It answers 429 after about ten quick requests, so the reader waits 3 seconds between them. The link it gives is a Himalayas page, not the company's posting.
- **Getro boards** (Communitech at `www1.communitech.ca`, Khosla, Accel, General Catalyst, Georgian, Radical): the job list is embedded in the board's public page (`/jobs?q=…`), 20 results per search and no paging. `api.getro.com` answers too, but its robots file disallows scripts, so the reader does not call it. The boards' robots files ask for 10 seconds between requests. `searchableLocations` adds parent regions ("North America" on a New York role), so only `locations` says where a role is. Accel and General Catalyst list remote.com reposts with the company named "Remote"; the reader drops them.
- **Wellfound** (`wellfound.com/role/r/<role>`): the remote role pages for `head-of-product` and `vp-of-product` exist; `director-of-product`, `head-of-growth` and any `/canada` path redirect away. Each listing has `acceptedRemoteLocationNames`.
- **Y Combinator** (`ycombinator.com/jobs/role/product-manager`): the `/canada` path matches California ("CA"), not Canada. `visa` says whether a role is US-only. Few roles at Director or above.
- **Mind the Product**: only the newest 20 roles are in the page; filters and paging go through an API its robots file disallows.
- **Workday** (`<tenant>.wd<N>.myworkdayjobs.com/wday/cxs/<tenant>/<site>/jobs`): 20 per page at most. Some sites accept a country filter (`locationCountry`, Canada is `a30a87ed25634629aa6c3958aa2b91ea`; CrowdStrike does, Nvidia does not). The list has no description or exact date; the posting's own address under `/wday/cxs/…` has both.
- **Amazon** (`amazon.jobs/en/search.json?base_query=product&country=CAN&sort=recent`): a loose text match, so the title filter does the work.
- **Himalayas' apply link needs a Himalayas account**, and its `pubDate` is when it listed the role, which can be months after the company posted it. Find the role on the company's own board for the link and the date.
- **Workday site names are not guessable.** `autodesk.wd1.myworkdayjobs.com/…/Ext` answers but holds 4 roles; Autodesk's main careers site is under another name. Read the site name off the company's careers page address.
- **Blocked for scripts, fine in Chrome:** startup.jobs (`?q=<title>&remote=true`) and hiring.cafe (`?searchState=` with URL-encoded JSON such as `{"searchQuery":"head of product"}`; it defaults to the visitor's country).
- **Not worth reading:** Remote OK, Remotive, Working Nomads and Hacker News "Who is hiring" had no fitting senior product roles; Indeed and Glassdoor answer 403; TrueUp ignores its title filter in the address (Lenny's Jobs is built on it); ExecThread needs a LinkedIn sign-in; Built In has no path that restricts to Canada; a16z, Sequoia, Bessemer, Lightspeed, Kleiner Perkins and First Round show scripts a captcha.

## Google and Meta careers

- Google: `google.com/about/careers/applications/jobs/results?q="product manager"&location=Canada` returns a count ("5 jobs matched") and role titles in `h3` elements. A plain `q=product` matches 46 roles, mostly sales and engineering.
- Meta: `metacareers.com/jobsearch/?q=product manager&offices[0]=Toronto, ON&offices[1]=Montreal, Canada&offices[2]=Remote, Canada` keeps the offices in the address and shows "N Items".
