# Security

Fenix runs on your own computer, at `http://localhost:3007`, with no login. It holds personal data (your career history, applications and interview notes), so a flaw that lets another website, another person on the network or a crafted file read or change that data matters.

## Reporting a problem

Please report it privately through GitHub: **Security → Report a vulnerability** on this repository. Don't open a public issue. You'll get a reply within a week.

Useful to include: what an attacker could read or change, the steps to reproduce, and the commit you tested.

## What Fenix already guards against

- `pnpm dev` listens on `127.0.0.1` only, so other computers on your network can't reach it.
- Only Fenix's own pages can change data: every API request that writes something must come from the same origin (`proxy.ts`).
- One person's data never shows on another person's pages (`pnpm check:isolation`).
- CV designs are Liquid templates rendered in a sandboxed worker with a time limit; a design can lay out data but can't run code.
- Personal data lives in `data/`, a separate git repository that this repository ignores.

## Not in scope

Exposing the dev server beyond `localhost` (for example with `--hostname 0.0.0.0` or a tunnel) removes the main protection. Fenix isn't built to run as a shared or public server.
