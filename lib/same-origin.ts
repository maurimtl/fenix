const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * False when a state-changing request comes from another website. Any site open in the browser can send requests to
 * localhost, and a DNS-rebinding page can reach it under its own host name, so the Host must be local and
 * Sec-Fetch-Site or Origin, when sent, must name this origin. Browsers send at least one of them on every POST, PATCH
 * and DELETE; a request with neither comes from a local tool (the skills' curl calls), which already has the files.
 */
/** False when the request's Host isn't this computer, as with a DNS-rebinding page reaching localhost under its own name. */
export function localHost(req: Request): boolean {
  return LOCAL_HOSTS.has((req.headers.get("host") ?? "").replace(/:\d+$/, ""));
}

export function sameOrigin(req: Request): boolean {
  if (!localHost(req)) return false;
  const host = req.headers.get("host") ?? "";
  const site = req.headers.get("sec-fetch-site");
  const origin = req.headers.get("origin");
  if (site !== null && site !== "same-origin" && site !== "none") return false;
  return origin === null || origin === `http://${host}`;
}
