"""Scan company job boards (Ashby, Greenhouse, Lever public APIs) for senior product/growth/AI roles.

Usage: python3 boards.py [slug ...]   (default: every slug in watchlist.txt plus $FENIX_WATCHLIST_EXTRA)
Prints one line per matching role; writes all matches as JSON to $OUT (default boards.json).
Each match has source (ashby|greenhouse|lever) + sourceJobId, ready for POST /api/p/<person>/jobs.
$FENIX_HOME_MATCH is a regex for the person's country and cities (e.g. "canada|toronto|north america");
roles whose location or description match it are flagged home-mention=True.
$FENIX_WATCHLIST_EXTRA is a comma-separated list of extra slugs (the person's settings.watchlistExtra).
"""
import html, json, os, re, sys, urllib.request
from pathlib import Path

TITLE = re.compile(r"\b(director|head|s?vp|evp|vice president|chief|gm|general manager)\b.*\b(product|growth|ai)\b"
                   r"|\b(product|growth)\b.*\b(director|head|s?vp|evp|vice president|lead)\b", re.I)
SKIP = re.compile(r"design|marketing|engineer|sales|account|counsel|legal|finance", re.I)
HOME = re.compile(os.environ["FENIX_HOME_MATCH"], re.I) if os.environ.get("FENIX_HOME_MATCH") else None


def get(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "fenix-hunt"})
        return json.load(urllib.request.urlopen(req, timeout=20))
    except Exception:
        return None


def ashby(slug):
    d = get(f"https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true")
    for j in (d or {}).get("jobs", []):
        locs = [j.get("location", "")] + [x.get("location", "") for x in j.get("secondaryLocations") or []]
        yield dict(sourceJobId=j["id"], title=j["title"], loc="; ".join(filter(None, locs)), remote=j.get("isRemote"),
                   url=j.get("jobUrl"), comp=(j.get("compensation") or {}).get("compensationTierSummary"),
                   text=j.get("descriptionPlain", ""))


def greenhouse(slug):
    d = get(f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true")
    for j in (d or {}).get("jobs", []):
        text = re.sub(r"<[^>]+>", " ", html.unescape(j.get("content", "")))
        pay = re.search(r"\$\s?\d{2,3}[,\d]*\s?(?:-|–|to)\s?\$?\s?\d{2,3}[,\d]*", text)
        yield dict(sourceJobId=str(j["id"]), title=j["title"], loc=(j.get("location") or {}).get("name", ""), remote=None,
                   url=j.get("absolute_url"), comp=pay.group(0) if pay else None, text=text)


def lever(slug):
    d = get(f"https://api.lever.co/v0/postings/{slug}?mode=json")
    for j in d if isinstance(d, list) else []:
        c = j.get("categories", {})
        text = " ".join([j.get("descriptionPlain", ""), *(l.get("content", "") for l in j.get("lists", [])), j.get("additionalPlain") or ""])
        s = j.get("salaryRange") or {}
        yield dict(sourceJobId=j["id"], title=j["text"], loc=", ".join(c.get("allLocations") or [c.get("location", "")]),
                   remote=j.get("workplaceType") == "remote", url=j.get("hostedUrl"),
                   comp=f"{s.get('currency','')} {s.get('min')}-{s.get('max')}" if s else None, text=text)


def scan(slug, board=None):
    for name, fn in [("ashby", ashby), ("greenhouse", greenhouse), ("lever", lever)]:
        if board and board != name:
            continue
        jobs = list(fn(slug))
        if jobs:
            return name, jobs
    return None, []


def main():
    here = Path(__file__).parent
    extra = [e.strip() for e in os.environ.get("FENIX_WATCHLIST_EXTRA", "").split(",")]
    entries = sys.argv[1:] or [l.split("#")[0].strip() for l in (here / "watchlist.txt").read_text().splitlines()] + extra
    out = []
    for entry in filter(None, entries):
        slug, _, board = entry.partition(":")
        src, jobs = scan(slug, board or None)
        hits = [j for j in jobs if TITLE.search(j["title"]) and not SKIP.search(j["title"])]
        print(f"== {slug}: {src or 'NOT FOUND'} {len(jobs)} jobs, {len(hits)} senior product/growth")
        for j in hits:
            home = bool(HOME and HOME.search(j["loc"] + " " + j["text"]))
            print(f"   {j['sourceJobId']} | {j['title'][:70]} | {j['loc'][:60]} | home-mention={home} | {(j['comp'] or '')[:50]}")
            out.append(dict(company=slug, source=src, homeMention=home, **j))
    Path(os.environ.get("OUT", "boards.json")).write_text(json.dumps(out))


if __name__ == "__main__":
    main()
