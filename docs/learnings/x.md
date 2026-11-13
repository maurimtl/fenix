# X (Twitter)

## Search for hiring posts

`https://x.com/search?q=<query>&f=live` opens the Latest tab for a signed-in account (tested 2026-11-13). Operators work in the address: quoted phrases, `OR`, parentheses and `-filter:replies`. One query for `("we're hiring" OR "hiring a") ("head of product" OR "VP product" OR "head of growth") -filter:replies` returned six posts in a day; two or three were real openings.

Each post is an `article[data-testid="tweet"]`; its `time` element has the date and `[data-testid="tweetText"]` the text. A signed-in session shows `[data-testid="SideNav_AccountSwitcher_Button"]`.

Marc Baselga (@MarcBaselga, who runs the Supra community of product leaders) posts a curated list of open product-leadership roles every two weeks; his posts come up in these searches and are worth opening.

X's terms restrict automated reading. The hunt runs at most four searches a run in the person's own session, reads only, and stops on any restriction notice.
