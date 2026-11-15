"""Save one scanned role to Fenix without its description passing through the session.

  python3 post_job.py --profile <p> --key <source:id> --json '<fields>' [--from scan.json] [--dry-run]

The role's facts and its whole posting come from the scan file (scan.py's or boards.py's $OUT); `--json` adds what the
session judged: company (the display name), compMin, compMax, currency, compSource, compEvidence, remoteVerdict,
remoteEvidence, fitScore, whyGood, redFlags, jdSummary. Fields in `--json` win over the scan file's."""
import argparse, json, sys, urllib.error, urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import hunt_ats
from hunt_http import FetchError

REQUIRED = ("compSource", "remoteVerdict")
# Amazon roles are stored under the company's own site, with the number in the key as the id.
SAVED_SOURCE = {"amazon": "company_site"}


class Refused(Exception):
    pass


def find_role(key, files):
    for name in files:
        path = Path(name)
        if not path.exists():
            continue
        for r in json.loads(path.read_text()):
            if f"{r.get('source')}:{r.get('sourceJobId')}" == key:
                return r
    looked = ", ".join(files)
    raise Refused(f"{key} is not in {looked}. A full scan leaves out roles already marked seen; look the company up with "
                  f"`python3 boards.py <company>` and retry with `--from boards.json`.")


def build_body(role, fields, detail=hunt_ats.fetch_detail):
    """The body for POST /api/p/<p>/jobs. Fetches the description when the scan's detail cap left it out."""
    if role.get("source") not in hunt_ats.BOARDS:
        raise Refused(f"{role.get('source')} is a feed, not the company's posting. Find the role on the company's board first.")
    if not role.get("jd") and role.get("board"):
        try:
            detail(role)
        except (FetchError, KeyError, TypeError, AttributeError, ValueError) as e:
            raise Refused(f"could not fetch the description: {e}")
    jd = (role.get("jd") or "").strip()
    if not jd:
        raise Refused("the scan file has no description for this role; a saved posting is the whole text or nothing.")
    if jd.startswith("(Excerpt"):
        raise Refused("the description is an excerpt; a saved posting is the whole text or nothing.")
    body = {"source": SAVED_SOURCE.get(role["source"], role["source"]), "sourceJobId": role["sourceJobId"], "url": role["url"],
            "company": role["company"], "title": role["title"], "jdText": jd}
    if role.get("jdFormat"):
        body["jdFormat"] = role["jdFormat"]
    if role.get("loc"):
        body["locationText"] = role["loc"][:300]
    if role.get("postedAt"):
        body.update(postedAt=role["postedAt"], postedAtSource="board")
    body.update(fields)
    missing = [f for f in REQUIRED if not body.get(f)]
    if missing:
        raise Refused(f"--json is missing {', '.join(missing)}")
    return body


def post(base, profile, body):
    url = f"{base}/api/p/{profile}/jobs"
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise Refused(f"Fenix answered {e.code}: {e.read().decode('utf-8', 'replace')[:600]}")
    except Exception as e:
        raise Refused(f"Fenix did not answer at {url} ({type(e).__name__}); is it running?")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--profile", required=True)
    ap.add_argument("--key", required=True, help="source:id as the scan prints it")
    ap.add_argument("--json", default="{}", dest="fields", help="the judgment fields, as a JSON object")
    ap.add_argument("--from", dest="files", action="append", help="scan file to read (default: scan.json, then boards.json)")
    ap.add_argument("--base", default="http://localhost:3007")
    ap.add_argument("--dry-run", action="store_true", help="print the body and post nothing")
    a = ap.parse_args(argv)
    try:
        fields = json.loads(a.fields)
        if not isinstance(fields, dict):
            raise Refused("--json must be a JSON object")
        body = build_body(find_role(a.key, a.files or ["scan.json", "boards.json"]), fields)
        if a.dry_run:
            print(json.dumps(body, indent=1, ensure_ascii=False))
            return 0
        res = post(a.base, a.profile, body)
        print(f"{body['company']} | {body['title']} -> {res.get('stage')} {res.get('id')} {'new' if res.get('created') else 'updated'}")
        return 0
    except (Refused, ValueError) as e:
        print(f"not saved: {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
