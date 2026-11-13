"""The scanner's only network code: small GET and POST helpers that raise FetchError with the reason."""
import json, urllib.error, urllib.request

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36 fenix-hunt"


class FetchError(Exception):
    """status is the HTTP code, or 0 when there was no answer."""

    def __init__(self, status, reason):
        super().__init__(f"{status or 'no answer'} {reason}".strip())
        self.status = status


def fetch(url, body=None, headers=None, timeout=25):
    h = {"User-Agent": UA, "Accept": "application/json, text/html;q=0.9, */*;q=0.8"}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        h["Content-Type"] = "application/json"
    h.update(headers or {})
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=h), timeout=timeout) as r:
            return r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        raise FetchError(e.code, e.reason or "")
    except Exception as e:  # timeouts, DNS, TLS
        raise FetchError(0, type(e).__name__)


def fetch_json(url, body=None, headers=None):
    text = fetch(url, body, headers)
    try:
        return json.loads(text)
    except ValueError:
        raise FetchError(200, "not JSON")
