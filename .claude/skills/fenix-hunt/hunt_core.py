"""Pure helpers for the hunt scanner: title filters, dates, posting links, merging. No network, no files."""
import html, re
from datetime import datetime, timedelta, timezone

SENIOR = re.compile(r"\b(director|head|s?vp|evp|vice president|chief|cpo|gm|general manager)\b.*\b(product|growth|ai)\b"
                    r"|\b(product|growth)\b.*\b(director|head|s?vp|evp|vice president|lead)\b", re.I)
WIDE = re.compile(r"\b(product|growth)\b", re.I)
SKIP = re.compile(r"design|marketing|engineer|sales|account|counsel|legal|finance", re.I)
# "product" and "growth" in a dream company's title are often not product work: Product Architect, Product Security.
WIDE_SKIP = re.compile(r"architect|communications|content|partner|security|data scien|reliab|compliance|polic|recruit|support"
                       r"|analyst|research|software|developer|program manager|counsel|intern\b", re.I)
REPOST_HOSTS = re.compile(r"(^|\.)(remote\.com|jobgether\.com|theladders\.com)$", re.I)

FEED_QUERIES = ["head of product", "vp product", "director of product", "chief product officer",
                "head of growth", "product growth", "ai product", "ai transformation"]
ISO3 = {"CA": "CAN", "US": "USA", "GB": "GBR", "IE": "IRL", "AU": "AUS", "DE": "DEU", "FR": "FRA", "NL": "NLD",
        "ES": "ESP", "MX": "MEX", "IN": "IND", "BR": "BRA"}


def keep_title(title, wide=False):
    """Senior product, growth or AI titles; with wide (dream companies) any product or growth title."""
    if not title or SKIP.search(title):
        return False
    if SENIOR.search(title):
        return True
    return bool(wide and WIDE.search(title) and not WIDE_SKIP.search(title))


def strip_html(text):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html.unescape(text or ""))).strip()


def iso(value):
    """A source's date (ISO text, epoch seconds or milliseconds) as UTC ISO text; None when missing or unreadable."""
    try:
        if isinstance(value, bool) or value is None or value == "":
            return None
        if isinstance(value, (int, float)):
            d = datetime.fromtimestamp(value / 1000 if value > 1e11 else value, timezone.utc)
        else:
            text = re.sub(r" UTC$", "+00:00", str(value).strip()).replace("Z", "+00:00")
            text = re.sub(r"(\.\d{3})\d+", r"\1", text)
            d = datetime.fromisoformat(text)
            d = d.replace(tzinfo=timezone.utc) if d.tzinfo is None else d.astimezone(timezone.utc)
        return d.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    except (TypeError, ValueError, OverflowError, OSError):
        return None


def iso_from(text, fmt):
    try:
        d = datetime.strptime(text.strip(), fmt)
        d = d.replace(tzinfo=timezone.utc) if d.tzinfo is None else d.astimezone(timezone.utc)
        return d.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    except (AttributeError, ValueError):
        return None


def iso_ago(text, now=None):
    """'16 days', 'about 2 months', 'Posted 8 Days Ago' as an approximate date. None for 'Posted 30+ Days Ago'."""
    now = now or datetime.now(timezone.utc)
    word = re.search(r"\b(today|just posted|yesterday)\b", text or "", re.I)
    m = re.search(r"(\d+)(\+)?\s*(minute|hour|day|week|month|year)", text or "", re.I)
    if word:
        d = now - timedelta(days=1 if word.group(1).lower() == "yesterday" else 0)
        return d.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    if not m or m.group(2):
        return None
    days = {"minute": 1 / 1440, "hour": 1 / 24, "day": 1, "week": 7, "month": 30, "year": 365}[m.group(3).lower()]
    d = now - timedelta(days=int(m.group(1)) * days)
    return d.strftime("%Y-%m-%dT%H:%M:%S.000Z")


def norm(text):
    return re.sub(r"[^a-z0-9]", "", (text or "").lower())


def posting_ref(url):
    """(board, id) when the link is an Ashby, Greenhouse or Lever posting; None otherwise."""
    u = url or ""
    m = re.search(r"jobs\.ashbyhq\.com/[^/?#]+/([0-9a-f]{8}-[0-9a-f-]{27})", u, re.I)
    if m:
        return "ashby", m.group(1).lower()
    m = re.search(r"jobs\.(?:eu\.)?lever\.co/[^/?#]+/([0-9a-f]{8}-[0-9a-f-]{27})", u, re.I)
    if m:
        return "lever", m.group(1).lower()
    m = re.search(r"greenhouse\.io/[^?#]*?/jobs/(\d+)", u, re.I) or re.search(r"[?&]gh_jid=(\d+)", u, re.I)
    if m:
        return "greenhouse", m.group(1)
    return None


def is_repost_link(url):
    m = re.match(r"https?://([^/?#]+)", url or "", re.I)
    return bool(m and REPOST_HOSTS.search(m.group(1)))


def role(source, job_id, company, title, url, loc="", remote=None, comp=None, posted=None, text="", feed=None):
    return dict(source=source, sourceJobId=str(job_id), company=company or "", title=title or "", loc=loc or "",
                remote=remote, url=url, comp=comp, postedAt=posted, text=text or "", via=[feed] if feed else [],
                dream=False)


def key(r):
    return f"{r['source']}:{r['sourceJobId']}"


def resolve_posting(r):
    """A feed role whose link is a company-board posting takes that board's source and id, ready to save."""
    ref = posting_ref(r["url"]) if r["via"] else None
    if ref:
        r["source"], r["sourceJobId"] = ref
    return r


def merge(roles):
    """One row per posting. Same board and id always merge; across sources, the same company and title merge.
    Two roles from one source never merge by name. Returns (roles, merged count per losing source)."""
    out, by_key, by_name, merged = [], {}, {}, {}

    def absorb(winner, loser):
        label = loser.get("origin") or (loser["via"] or [loser["source"]])[0]
        merged[label] = merged.get(label, 0) + 1
        for v in loser["via"]:
            if v not in winner["via"]:
                winner["via"].append(v)
        for f in ("comp", "postedAt", "loc", "text"):
            if not winner.get(f) and loser.get(f):
                winner[f] = loser[f]
        winner["dream"] = winner["dream"] or loser["dream"]

    # Company-board copies first, so they win.
    for r in sorted(roles, key=lambda r: bool(r["via"])):
        k = key(r)
        if k in by_key:
            absorb(by_key[k], r)
            continue
        name = (norm(r["company"]), norm(r["title"]))
        other = by_name.get(name) if all(name) else None
        if other is not None and other["source"] != r["source"] and (other["via"] or [None])[0] != (r["via"] or [None])[0]:
            absorb(other, r)
            by_key[k] = other
            continue
        by_key[k] = r
        if all(name):
            by_name.setdefault(name, r)
        out.append(r)
    return out, merged


def newest_first(roles):
    return sorted(roles, key=lambda r: r["postedAt"] or "", reverse=True)


def money(lo, hi, currency):
    if not lo and not hi:
        return None
    span = "-".join(str(int(v)) for v in (lo, hi) if v)
    return f"{currency or ''} {span}".strip()
