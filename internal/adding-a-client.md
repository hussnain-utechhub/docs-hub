# Adding a client, from empty folder to live page

Staff notes. Nothing in `internal/` is ever published.

The short version: **make a folder, put `.md` files in it, push.** Everything else is automatic.
The one step that is not automatic, and the one that actually controls who can read the pages, is
the access rule — step 6.

**The whole of a client is a folder with a `docs/` folder in it.** No config file is required, no
list to register it on, no routes, no navigation file. Name the front page `index.md` and it
becomes the client's front page; everything else appears in the sidebar from the folder structure.

---

## 1. Make the client

```bash
npm run new-client -- acme-corp "Acme Corp"
```

Or do it by hand — the script only saves typing and checks the name:

```
clients/acme-corp/
  client.json      { "name": "Acme Corp" }
  docs/
    intro.md
```

**The folder name becomes the public URL**, so `acme-corp` is what the client sees in the address
bar. Lower-case letters, digits and single hyphens only; anything else either breaks the access
rule or produces a URL that needs escaping. The script refuses a bad name, and refuses to
overwrite a client that already exists.

**`client.json` is optional.** Without it the display name comes from the folder name —
`acme-corp` becomes "Acme Corp". Write one only when that is not the name you want shown, or to
add a tagline:

| Field | Required | What it does |
|---|---|---|
| `name` | no | Display name. Defaults to the folder name, tidied up |
| `tagline` | no | Sits under the title |

The build finds any folder under `clients/` that has a `docs/` folder. A folder whose name starts
with `_` is skipped, which is a way to park a client without deleting it.

---

## 2. Write the docs

Markdown files under `clients/acme-corp/docs/`. Drag them in, or write them in the GitHub web
editor — a browser is enough, nobody needs the repo cloned.

**Folders become navigation.** A new file or folder appears in the sidebar on its own. There is no
navigation file to update.

```
docs/
  intro.md                      -> /acme-corp/
  projects/
    _category_.json             -> names the "Projects" section
    salesforce-portal/
      _category_.json
      scope.md                  -> /acme-corp/projects/salesforce-portal/scope/
      go-live.md
```

Nesting is unlimited: client → projects → a project → its pages all work.

### The front page

**Name it `index.md`.** That is all — no front matter, no settings. It becomes the client's front
page at `/acme-corp/`.

This matters more than it looks: `/acme-corp/` is both the link you hand the client and the path
the access rule covers. A client folder with no `index.md` serves every deep page perfectly while
its own front page 404s. The check in step 4 fails loudly if that ever happens.

### Front matter, all of it optional

No page needs any. When you want to override something:

```markdown
---
sidebar_position: 1
title: Overview
---
```

- `sidebar_position` — order within its folder. Lower is higher up.
- `title` — the sidebar label. Without it, the first `# Heading` is used.
- `slug: /` — an alternative way to make a page the front page, if you would rather not call the
  file `index.md`. Only one page per client may have it.

### Naming a section

`_category_.json` inside a folder, all fields optional:

```json
{
  "label": "Projects",
  "position": 2,
  "link": { "type": "generated-index", "slug": "/projects" }
}
```

`link` gives the section its own landing page listing what is inside. **Set `slug` if you add
one** — without it the page lands at `/category/projects/`, not `/projects/`, and any link you
wrote to the obvious path breaks the build.

### Images

Put them beside the page and reference them relatively:

```markdown
![The portal home page](./img/home.png)
```

A broken **markdown** image fails the build. A raw `<img src="...">` tag does not — the check in
step 4 covers those.

---

## 3. Preview it

```bash
npm start -- acme-corp
```

One client at a time, which is the same single-client build the deploy uses, so what you see is
what that client gets. Live reload: save a file and the browser updates.

---

## 4. Check it before pushing

```bash
npm run build      # builds every client into dist/<client>/
npm run verify     # proves no client's build contains another's content
```

`verify` needs a build first and exits non-zero on failure, which is why CI runs it between
building and deploying. It checks ten things; the ones worth knowing:

- **Canary leak** — a `CANARY-XXXX` token in one client's docs must appear in that client's output
  and nowhere else. Worth keeping one line of it on each client's front page; it is the strongest
  isolation evidence there is.
- **Build is current, not stale** — a failed build leaves the previous `dist/` in place, so every
  other check could otherwise pass against output that no longer matches the source.
- **Client root page exists** — catches the missing `slug: /` from step 2.
- **Shared root holds no files** — anything at the top of `dist/` sits above every access rule.

---

## 5. Push

```bash
git add -A
git commit -m "Add Acme Corp"
git push
```

CI builds every client, runs `verify`, and deploys only if it passes. Nothing else to configure.

---

## 6. Add the access rule — the step that is not automatic

**On the gated host (Cloudflare Access), a new client folder is unreachable until a rule exists
for it.** Access is deny-by-default, which is the safe direction — but it also means the client
you just set up cannot open their own link until you write the rule.

```
docs.yourfirm.com/acme-corp*   ->  allow emails ending in @acme.com
```

Write it when you create the folder, not when you send the link.

> **The trap:** a wildcard path does not cover its own parent. A rule for `/acme-corp/*` leaves
> `/acme-corp` — the client's front page — **ungated**. Write it `/acme-corp*`, and open the bare
> path in a private window before handing the link over.

Full detail, including the four tests to run before any client link goes out, is in
[access-rules.md](access-rules.md).

---

## What happens to a client who has no rule yet

On the gated host: refused. On the **GitHub Pages test target there is no gate at all**, so every
client folder is readable by anyone who guesses the URL. See the warning at the top of
`.github/workflows/deploy.yml` — that target is for fictional demo clients only.

---

## Where it ends up

| Host | A client's URL |
|---|---|
| GitHub Pages (test) | `https://<user>.github.io/docs-hub/acme-corp/` |
| Custom domain (gated) | `https://docs.yourfirm.com/acme-corp/` |

The difference is one repo variable, `BASE_PREFIX` — `/docs-hub` for a project Pages site, unset
for a custom domain serving from the root. It is the setting people forget: wrong, and every asset
resolves one directory too high, so the site deploys green and renders unstyled.

---

## Removing a client

Delete `clients/<name>/`, push, and **delete the access rule**. The folder stops being built, so
the pages stop existing. Deleting the rule without deleting the folder leaves the pages in place
and unreachable only by policy; deleting the folder is what actually removes them.
