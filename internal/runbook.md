# Runbook

## A client's site is empty or missing after a push

Check the build log for that client. `build-all.mjs` continues past a failing client and reports
`Built N/M` at the end, so a single failure does not stop the others — it is easy to miss if you
only read the last line.

## The build reports a failure with no error text at all

On Windows: something is calling `node_modules/.bin/docusaurus` instead of the JavaScript entry
point. That shim is a `.cmd`, which `execFileSync` cannot spawn — it fails with EINVAL and prints
nothing, so the build looks like it broke for a content reason when it never started. Both scripts
here already spawn `node node_modules/@docusaurus/core/bin/docusaurus.mjs` for this reason; if you
add a third script, do the same.

## A link is broken

The build throws on broken internal links, so it will not ship one. If you want to find them
without a full build, the error names the file and the link.

## An image is missing but the build passed

Expected: `onBrokenLinks` does **not** check images. `npm run verify` does — that is check 7. Run
it after every build; CI already does.

## A client says they cannot open their site

Almost always the access rule, not the build. In order:

1. Does `dist/<client>/` exist in the last build?
2. Does an Access rule exist for `/<client>*`?
3. Is the rule written as `/<client>*` and not `/<client>/*`? The second leaves the front page
   ungated and, depending on the other rules, can also leave it unreachable.
4. Is the broad staff rule **below** the per-client rules? A broad rule placed first answers
   everything and the specific rules never run.

## Adding a client, in full

```bash
npm run new-client -- their-name "Their Name"
# write docs in clients/their-name/docs/
npm start -- their-name        # preview
npm run build && npm run verify
git add -A && git commit -m "Add Their Name" && git push
# then: add the Access rule for /their-name*
```

## Search

There is no search plugin installed. If you add one, note that `noIndex: true` in
`docusaurus.config.js` empties a local search index unless the plugin is given
`forceIgnoreNoIndex`. The `noIndex` is there on purpose — these sites are not for crawlers — so
configure the plugin rather than removing it.
