# Access rules — who can open which client's docs

Staff notes. Nothing in `internal/` is ever built or published; the build script only scans
`clients/`, so this is private by construction rather than by a rule somebody has to remember.

## Why there is a gate at all

A GitHub Pages site is readable by the entire internet **even when the repository is private**.
Private Pages is a GitHub Enterprise Cloud feature. Making the repo private protects the *source*
and does nothing to the published site.

So the published output has to sit behind something that checks who is asking. That is the whole
reason this hub builds each client separately: the gate decides *who*, and the separate builds
decide *what is even in the folder to serve*. Two independent layers, and the second one holds
even if the first is misconfigured.

**Do not publish this to GitHub Pages.** The CI workflow says so too.

## The recommended gate

Cloudflare Access, in front of whatever hosts `dist/`. The reason it fits is one feature: the
client needs **no account and no password**. They enter their email, receive a code, and are in.
Nothing to provision, nothing to reset, and removing access is deleting a rule.

Cost: Zero Trust is free to 50 users, then $7 per user per month. One or two contacts per client
plus staff keeps a handful of clients inside the free tier.

## The rules

One rule per client path, on a single domain:

```
docs.yourfirm.com/acme-corp*   ->  allow emails ending in @acme.com
docs.yourfirm.com/globex-ltd*  ->  allow maria@globex.com, ops@globex.com
docs.yourfirm.com/initech*     ->  allow emails ending in @initech.io
docs.yourfirm.com/*            ->  allow emails ending in @yourfirm.com   (staff, last)
```

Access is **deny-by-default**: a path with no matching rule is refused. So a new client folder is
unreachable until its rule exists. That is the safe failure direction — but it also means a client
handed the link before the rule is written will be turned away, so write the rule when you create
the folder, not when you send the link.

Order matters: the broad staff rule goes **last**, or it answers first and the per-client rules
never get consulted.

## The trap that will catch you

> A wildcard path does not cover its own parent.

A rule for `/acme-corp/*` leaves `/acme-corp` — the client's own front page — **ungated**. Write
it as `/acme-corp*`, or add both, and **open the bare path in a private window before handing the
link over**. This is confirmed in Cloudflare's own documentation and it is the single most likely
way this setup leaks.

## Before the first client link goes out

This is the part that is **not** proven yet. The design above comes from Cloudflare's
documentation — path-scoped rules, email and email-domain matching, emailed sign-in codes,
deny-by-default — but it has not been stood up and tested end to end. It needs a domain and about
an hour.

Test it with a **real second email address** that is not yours, and check all four of these:

1. The allowed address can open `/<client>/` and a deep page under it.
2. The same address is **refused** at another client's path.
3. The **bare** path `/<client>` (no trailing slash) is gated, not just `/<client>/`.
4. A random address with no matching rule is refused everywhere.

Until those four pass, treat every published URL as public.
