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
