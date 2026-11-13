"""The hunt scanner: every job source a script can read, as one list of new roles, newest first.

  python3 scan.py --profile <person>          full scan: company boards (watchlist.txt + the person's extras and
                                              dream companies) and feeds (feeds.txt); hides roles already marked seen
  python3 scan.py <slug>[:board[:extra]] ...  look up companies only; nothing hidden; writes boards.json
  python3 scan.py --profile <person> --mark-seen <key> ...   record judged roles (keys are printed per role)

Options: --all (show seen roles too), --only boards|feeds. $OUT is the JSON path (default scan.json for a full scan).
With --profile the running app supplies the home country, watchlist extras, dream companies and seen keys
($FENIX_APP_URL, default http://localhost:3007). Without it, use $FENIX_HOME_COUNTRY (e.g. CA),
$FENIX_WATCHLIST_EXTRA and $FENIX_DREAM (comma-separated entries). $FENIX_HOME_MATCH is a regex for the person's
country and cities (default with --profile: the country's name); roles whose location or description match it are
flagged home=True.

Each role in the JSON has source + sourceJobId (the company board's own when the role is on Ashby, Greenhouse or
Lever, ready for POST /api/p/<person>/jobs), postedAt, via (the feeds that listed it) and key (for --mark-seen).
"""
import json, os, re, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import hunt_feeds
from hunt_ats import scan_company
from hunt_core import keep_title, key, merge, newest_first, resolve_posting
from hunt_http import FetchError, fetch_json

HERE = Path(__file__).parent
APP = os.environ.get("FENIX_APP_URL", "http://localhost:3007").rstrip("/")


def lines(name):
    return [l.split("#")[0].strip() for l in (HERE / name).read_text().splitlines() if l.split("#")[0].strip()]


def csv_env(name):
    return [e.strip() for e in os.environ.get(name, "").split(",") if e.strip()]


def parse_args(argv):
    opts = dict(profile=None, all=False, only=None, mark=None, entries=[])
    it = iter(argv)
    for a in it:
        if a == "--profile":
            opts["profile"] = next(it, None)
        elif a == "--only":
            opts["only"] = next(it, None)
        elif a == "--all":
            opts["all"] = True
        elif a == "--mark-seen":
            opts["mark"] = list(it)
        elif a.startswith("--"):
            sys.exit(f"unknown option {a}")
        else:
            opts["entries"].append(a)
    return opts


def status_line(name, s):
    """One line per source: what was read, kept, and why anything is missing from the list."""
    if s["status"] == "notfound":
        return f"== {name}: NOT FOUND"
    if s["status"] == "failed":
        return f"== {name}: FAILED {s['reason']}"
    parts = [f"{s['read']} read" if s["read"] else "0 read", f"{s['kept']} kept"]
    for label, n in (("dropped (other region or repost)", s.get("dropped")), ("merged into another source", s.get("merged")),
                     ("hidden as seen", s.get("hidden"))):
        if n:
            parts.append(f"{n} {label}")
    if s.get("capped"):
        parts.append("capped: more results exist than were read")
    if s.get("details_capped"):
        parts.append("capped: descriptions fetched for the first 15 kept roles only")
    return f"== {name}: {s.get('board') or 'feed'} " + ", ".join(parts)


def role_line(r):
    flags = "".join([" | dream" if r["dream"] else "", f" | via {', '.join(r['via'])}" if r["via"] else ""])
    return (f"   {r['key']} | {(r['postedAt'] or 'unknown')[:10]} | {r['company'][:28]} | {r['title'][:70]} | {r['loc'][:60]}"
            f" | home={r['homeMention']} | {(r['comp'] or '')[:40]}{flags}")


def scan_boards(entries, dream, ctx):
    """entries and dream are 'slug[:board[:extra]]'. Returns (roles, {name: stats})."""
    wide = {e.split(":")[0] for e in dream}
    todo = list(dict.fromkeys(entries + [d for d in dream if d.split(":")[0] not in {e.split(":")[0] for e in entries}]))

    def one(entry):
        slug, board, extra = (entry.split(":", 2) + ["", ""])[:3]
        res = scan_company(slug, board or None, extra, ctx, lambda t: keep_title(t, slug in wide))
        for r in res["roles"]:
            r["dream"] = slug in wide
            r["origin"] = slug
        return slug, res

    roles, stats = [], {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        for slug, res in pool.map(one, todo):
            roles += res.pop("roles")
            stats[slug] = dict(res, kept=0)
    return roles, stats


def scan_feeds(ctx):
    roles, stats, getro = [], {}, []
    for entry in lines("feeds.txt"):
        kind, _, rest = entry.partition(":")
        if kind == "getro":
            host, _, name = rest.partition(":")
            getro.append((host, name or host))
            continue
        try:
            res = hunt_feeds.FEEDS[kind](rest, ctx)
        except KeyError:
            stats[kind] = dict(status="failed", reason="unknown feed")
            continue
        except (FetchError, ValueError, KeyError, TypeError) as e:
            stats[kind] = dict(status="failed", reason=str(e) or type(e).__name__)
            continue
        roles += [r for r in res["roles"] if keep_title(r["title"])]
        stats[kind] = dict(res, status="ok", kept=0, roles=None)
    if getro:
        results, errors = hunt_feeds.getro(getro, ctx)
        for name, res in results.items():
            if name in errors:
                stats[name] = dict(status="failed", reason=str(errors[name]))
                continue
            roles += [r for r in res["roles"] if keep_title(r["title"])]
            stats[name] = dict(res, status="ok", kept=0, roles=None)
    return roles, stats


def finish(roles, stats, seen, show_all, ctx):
    """Merge, hide seen, count per source, sort. Mutates stats; returns the roles to show."""
    for r in roles:
        r.setdefault("origin", (r["via"] or [r["company"]])[0])  # the stats entry this role is counted under
        resolve_posting(r)
    roles, merged = merge(roles)
    for name, n in merged.items():
        if name in stats:
            stats[name]["merged"] = n
    shown = []
    for r in roles:
        r["key"] = key(r)
        s = stats.get(r["origin"])
        if not show_all and r["key"] in seen:
            if s:
                s["hidden"] = s.get("hidden", 0) + 1
            continue
        if s:
            s["kept"] += 1
        r["homeMention"] = bool(ctx.get("home_re") and ctx["home_re"].search(f"{r['loc']} {r['text']}"))
        shown.append(r)
    for r in shown:
        del r["origin"]
    return newest_first(shown)


def main(argv=None):
    opts = parse_args(sys.argv[1:] if argv is None else argv)
    hunt = {}
    if opts["profile"]:
        try:
            hunt = fetch_json(f"{APP}/api/p/{opts['profile']}/hunt")
        except FetchError as e:
            sys.exit(f"could not read {APP}/api/p/{opts['profile']}/hunt ({e}); is Fenix running?")
    if opts["mark"] is not None:
        if not opts["profile"] or not opts["mark"]:
            sys.exit("--mark-seen needs --profile <person> and at least one key")
        done = fetch_json(f"{APP}/api/p/{opts['profile']}/hunt", {"seen": opts["mark"]})
        print(f"marked {done.get('added', 0)} new, {len(opts['mark']) - done.get('added', 0)} already seen")
        return

    # Without the person's own pattern, the country name alone still catches "Remote, Canada".
    pattern = os.environ.get("FENIX_HOME_MATCH") or (re.escape(hunt["homeCountryName"]) if hunt.get("homeCountryName") else None)
    ctx = dict(home_code=os.environ.get("FENIX_HOME_COUNTRY") or hunt.get("homeCountry"),
               home_name=hunt.get("homeCountryName"), home_re=re.compile(pattern, re.I) if pattern else None)
    lookup = bool(opts["entries"])
    dream = csv_env("FENIX_DREAM") or hunt.get("dreamCompanies") or []
    roles, stats = [], {}
    if lookup:
        wanted = {e.split(":")[0] for e in opts["entries"]}
        roles, stats = scan_boards(opts["entries"], [d for d in dream if d.split(":")[0] in wanted], ctx)
    else:
        # Feeds pause between requests (rate limits), so they run beside the company boards.
        with ThreadPoolExecutor(max_workers=1) as side:
            feeds = side.submit(scan_feeds, ctx) if opts["only"] != "boards" else None
            if opts["only"] != "feeds":
                extra = csv_env("FENIX_WATCHLIST_EXTRA") or hunt.get("watchlistExtra") or []
                roles, stats = scan_boards(lines("watchlist.txt") + extra, dream, ctx)
            if feeds:
                more, feed_stats = feeds.result()
                roles += more
                stats.update(feed_stats)
    seen = set() if lookup else set(hunt.get("seen") or [])
    shown = finish(roles, stats, seen, opts["all"] or lookup, ctx)

    for name, s in stats.items():
        print(status_line(name, s))
    print(f"\n{len(shown)} roles, newest first (key | posted | company | title | location | home | pay)")
    for r in shown:
        print(role_line(r))
    Path(os.environ.get("OUT", "boards.json" if lookup else "scan.json")).write_text(json.dumps(shown))


if __name__ == "__main__":
    main()
