# docs-hub

One private repo holding every client's documentation, published as **separate per-client sites**
so no client can reach another's pages.

**Adding a client is adding a folder.** No shared file changes, no registry to update, no
per-client configuration anywhere.

```
clients/
  acme-corp/
    client.json          { "name": "Acme Corp" }  <- the whole config
    docs/
      intro.md
      projects/
        _category_.json  { "label": "Projects" }  <- optional, sets the label
        salesforce-portal/
          scope.md
          go-live.md
  globex-ltd/            same shape, independent site
  initech/

internal/                staff notes - never built, never published
static/                  shared chrome (favicon); emitted under each client's own path

docusaurus.config.js     shared. reads CLIENT from the environment
sidebars.js              shared. sidebar is generated from the folders
scripts/                 build, serve, scaffold, verify
```

## Day to day

```bash
npm install

npm start -- acme-corp                   # preview one client, live reload
npm run build                            # build every client into dist/<client>/
npm run verify                           # prove no client's build holds another's content
npm run new-client -- acme-corp "Acme Corp"
```

`npm run verify` needs a build first. It exits non-zero on failure, which is why CI runs it
between the build and the deploy.

## Adding a client

1. `npm run new-client -- their-name "Their Name"` — or just make the folder by hand.
2. Write Markdown in `clients/their-name/docs/`, in whatever folder structure suits the work.
3. Commit and push. The build runs on push and builds every client.
4. **Add the access rule for `/their-name*`** before sharing the link.

Full walkthrough: [`internal/adding-a-client.md`](internal/adding-a-client.md).

Step 4 is the only step outside this repo, and it is done once per client. See
[`internal/access-rules.md`](internal/access-rules.md) — including the wildcard trap that leaves a
client's front page ungated.

## Three properties worth knowing

**Folders become navigation.** The sidebar is generated from the directory tree, so a new page or
project appears on its own. `_category_.json` is optional and only sets the display name and order.

**Nesting is unlimited.** Client → projects → a project → its pages works, which is what covers
"company, clients and projects" in one tree.

**Anything outside `clients/` is never published.** The build script scans that one folder, so
`internal/` is private by construction, not by a rule anyone has to remember.

## Why separate builds, not one site

Docusaurus has a multi-instance docs mode for several doc sets in one site, which looks like a fit.
It is not: one site is one build, so every client's pages, assets and search index ship in the same
output. A client could search and see another client's page titles, or fetch the index directly.
Separate builds remove that at the root — there is nothing of anyone else's in the folder to leak.

That is also why each client is served from `/<client>/`: its pages *and* every asset it emits sit
under one prefix, which is what a per-path access rule can actually cover.

## Where this is published

Not decided yet, and the CI workflow deliberately stops at building and uploading an artifact.

**Not GitHub Pages.** A Pages site is readable by the entire internet even from a private
repository — private Pages is a GitHub Enterprise Cloud feature. Cloudflare Pages is the option
that pairs with Cloudflare Access; the workflow has the block commented out, ready.

## Conventions

A `CANARY-SOMETHING` token in a client's docs is picked up automatically by `npm run verify`,
which checks it appears in that client's build and in **no other**. The three demo clients each
carry one. It is optional for real clients, but it is the strongest isolation evidence available,
so it is worth keeping one line of it in each client's front page.

The three `clients/*` folders here are demonstrations. Delete them once real clients exist — they
are what the verification currently runs against, so delete them *after* the first real client is
in, or the isolation check has nothing to compare.
