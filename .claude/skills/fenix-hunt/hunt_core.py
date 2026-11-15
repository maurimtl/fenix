"""Pure helpers for the hunt scanner: title filters, dates, posting links, merging. No network, no files."""
import html, re
from html.parser import HTMLParser
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


JD_MAX = 60_000  # Fenix's limit for a saved posting
_HEADINGS = {"h1", "h2", "h3", "h4", "h5", "h6"}
_BREAKS = {"p", "div", "br", "section", "article", "tr", "table", "blockquote"}
_LISTS = {"ul", "ol"}
_HEADING_MAX = 80


class _Markdown(HTMLParser):
    """A posting's HTML as light Markdown: '## ' headings, '- ' bullets, blank lines between paragraphs."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out, self.cur, self.prefix, self.links = [], [], "", []
        self.depth = self.bold = self.skip = 0
        self.bold_text = self.plain_text = False

    def flush(self):
        line = re.sub(r"\s+", " ", "".join(self.cur)).strip()
        self.links = []
        if not line:
            # An empty block (a <p> opening inside an <li>) keeps the pending bullet or heading mark.
            self.cur = []
            return
        prefix, bold_only = self.prefix, self.bold_text and not self.plain_text
        self.cur, self.prefix, self.bold_text, self.plain_text = [], "", False, False
        if not prefix and bold_only and len(line) <= _HEADING_MAX:
            prefix, line = "## ", line.rstrip(":")
        typed_bullet = re.match(r"(?:[-•]|\\?\*)\s+(?=\S)", line) if not prefix else None
        if typed_bullet:
            # Some boards type their bullets as text ("- item<br>"); they are bullets all the same.
            prefix, line = "- ", line[typed_bullet.end():]
        elif not prefix:
            # A line that only looks like a heading or a quote stays text.
            line = re.sub(r"^([#>+])", r"\\\1", line)
        if prefix.startswith("## ") and self.out and self.out[-1] != "":
            self.out.append("")
        self.out.append(prefix + line)
        if "- " not in prefix:
            self.out.append("")

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.skip += 1
        elif tag in _HEADINGS:
            self.flush()
            self.prefix = "## "
        elif tag == "li":
            self.flush()
            self.prefix = "  " * max(self.depth - 1, 0) + "- "
        elif tag in _LISTS:
            self.flush()
            self.depth += 1
        elif tag in _BREAKS:
            self.flush()
        elif tag in ("strong", "b"):
            self.bold += 1
        elif tag == "a":
            self.links.append((len(self.cur), dict(attrs).get("href") or ""))

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.skip = max(self.skip - 1, 0)
        elif tag in _LISTS:
            self.flush()
            self.depth = max(self.depth - 1, 0)
            if self.depth == 0 and self.out and self.out[-1] != "":
                self.out.append("")
        elif tag in _HEADINGS or tag == "li":
            self.flush()
            self.prefix = ""
        elif tag in _BREAKS:
            self.flush()
        elif tag in ("strong", "b"):
            self.bold = max(self.bold - 1, 0)
        elif tag == "a" and self.links:
            start, href = self.links.pop()
            label = re.sub(r"\s+", " ", "".join(self.cur[start:])).strip()
            # A block that closed inside the link has already flushed its text; then there is nothing to wrap.
            if label and re.match(r"https?://", href) and start <= len(self.cur):
                href = href.replace("(", "%28").replace(")", "%29").replace(" ", "%20")
                self.cur[start:] = [href if label.replace("\\", "") == href else f"[{label}]({href})"]

    def handle_data(self, data):
        if self.skip:
            return
        if data.strip():
            if self.bold:
                self.bold_text = True
            else:
                self.plain_text = True
        # The posting's own *, `, [ ] and word-edge _ are text, not Markdown.
        data = re.sub(r"([*`\[\]])", r"\\\1", data)
        self.cur.append(re.sub(r"(?<![^\W_])_|_(?![^\W_])", r"\\_", data))


_TYPED_BULLET = re.compile(r"^[-•·*–]\s+(?=\S)")
_SENTENCE_END = re.compile(r"[.!?,;…]$")


def plain_to_md(text):
    """A posting saved as plain text with line breaks, as light Markdown, without changing a word: typed bullets become
    bullets, and a short line that reads as a title a heading (at most 8 words, starts with a capital, no sentence ending,
    no "Label: value", no digits, and something after it)."""
    lines = [l.strip() for l in (text or "").replace("\r", "").split("\n") if l.strip()]
    kinds = []
    for i, line in enumerate(lines):
        if _TYPED_BULLET.match(line):
            kinds.append("bullet")
        elif (i + 1 < len(lines) and len(line) <= 60 and len(line.split()) <= 8 and line[0].isalpha() and line[0].isupper()
              and not _SENTENCE_END.search(line) and ": " not in line and not re.search(r"\d", line)):
            kinds.append("title")
        else:
            kinds.append("text")
    # Three or more title-like lines in a row are a title and its list (benefits, skills), not a stack of headings.
    i = 0
    while i < len(kinds):
        j = i
        while j < len(kinds) and kinds[j] == "title":
            j += 1
        if j - i >= 3:
            kinds[i + 1:j] = ["item"] * (j - i - 1)
        i = max(j, i + 1)
    parts, in_list = [], False
    for line, kind in zip(lines, kinds):
        listed = kind in ("bullet", "item")
        if listed:
            body = line[_TYPED_BULLET.match(line).end():] if kind == "bullet" else line
            parts.append(("" if in_list else "<ul>") + f"<li>{html.escape(body)}</li>")
        else:
            parts.append(("</ul>" if in_list else "") + (f"<h3>{html.escape(line.rstrip(':'))}</h3>" if kind == "title" else f"<p>{html.escape(line)}</p>"))
        in_list = listed
    return html_to_md("".join(parts) + ("</ul>" if in_list else ""))


def html_to_md(text):
    """A posting's HTML as light Markdown, cut to what Fenix stores. Plain text with no tags comes back as one paragraph."""
    parser = _Markdown()
    # A description cut off inside a tag would otherwise end with that tag's source as text.
    parser.feed(re.sub(r"<[^>]*$", "", text or ""))
    parser.close()
    parser.flush()
    return re.sub(r"\n{3,}", "\n\n", "\n".join(parser.out)).strip()[:JD_MAX]


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


def role(source, job_id, company, title, url, loc="", remote=None, comp=None, posted=None, text="", feed=None, jd="",
         jd_md=True, jd_html=None):
    """`text` is the flattened posting the filters read; `jd` is the posting as saved (Markdown unless jd_md is False).
    `jd_html` is the posting's HTML, converted by fill_jd only for roles that are kept."""
    r = dict(source=source, sourceJobId=str(job_id), company=company or "", title=title or "", loc=loc or "",
             remote=remote, url=url, comp=comp, postedAt=posted, text=text or "", via=[feed] if feed else [],
             dream=False, jd=(jd or "")[:JD_MAX], jdFormat="md" if jd and jd_md else None)
    if jd_html:
        r["jd_html"] = jd_html
    return r


def fill_jd(r):
    """Turn a kept role's HTML into the Markdown posting. A role whose HTML gives nothing keeps what it had."""
    md = html_to_md(r.pop("jd_html", None))
    if md:
        r["jd"], r["jdFormat"] = md, "md"
    return r


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
        if not winner.get("jd") and loser.get("jd"):
            winner["jd"], winner["jdFormat"] = loser["jd"], loser.get("jdFormat")
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
