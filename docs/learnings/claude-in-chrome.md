# Claude in Chrome

## Output with URLs comes back as `[BLOCKED: Cookie/query string data]`

`javascript_tool` withholds a result that contains URLs with query strings (for example `location.href` or a list of `a.href`). Return only what you need: a path, an id, or the link text. The result is also cut at about 1,000 characters, so return short rows in slices.

## Tabs can leave Claude's tab group

When a tab is moved out of the Claude tab group (by the person, or when a site opens a window), the tools can no longer reach it. Don't keep retrying: open the page in a new tab, and tell the person which old tab they can close.

## Forms can have hidden duplicate controls

Some application forms render a hidden copy of a dropdown next to the visible one. Setting the hidden copy changes nothing on screen or on submit. Pick controls that are visible (`el.offsetParent !== null`) and read the value back after setting it.

## Never navigate a filled form's tab

Typed answers and uploads live only in the page. Navigating that tab elsewhere (to check a posting, say) loses the whole form; a LocalStack application was lost this way. Open anything else in a new tab.
