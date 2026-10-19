/*
 * Prove the isolation rather than assert it.
 *
 * The claim this whole design rests on is that one client's published folder contains nothing
 * belonging to another client. That is a claim about build OUTPUT, so it is checked against
 * dist/ after a real build, not against the source.
 *
 * Run `npm run build` first, then `npm run verify`. Exits non-zero if any check fails, so it can
 * gate a deploy.
 *
 * WHAT EACH CHECK IS ACTUALLY FOR
 *
 *  1 every client built            - a silent build failure leaves a stale or missing folder,
 *                                    and the deploy would publish the gap without complaining
 *  2 canary leak                   - the direct test: a token unique to one client must appear
 *                                    in that client's output and NOWHERE else
 *  3 name/slug leak                - catches the subtler case the canary misses, where another
 *                                    client is referenced by name rather than by the token
 *  4 assets namespaced             - every asset URL a page requests must sit under this
 *                                    client's own /<client>/ prefix, or a per-path access rule
 *                                    cannot cover it
 *  5 shared root is empty          - a file at dist/ root is served above every access rule and
 *                                    is therefore readable by anyone who finds the domain
 *  6 internal/ never published     - staff notes must not appear in any client's output
 *  7 images resolve                - Docusaurus fails on a broken MARKDOWN image by itself, but
 *                                    not on a raw <img src="..."> tag; this covers those
 *  8 nested routing               - client -> projects -> project -> page must actually produce
 *                                    a page, since deep nesting is what "projects" relies on
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CLIENTS_DIR = path.join(ROOT, "clients");
const DIST = path.join(ROOT, "dist");

const results = [];
const pass = (name, detail) => results.push({ name, detail, ok: true });
const fail = (name, detail) => results.push({ name, detail, ok: false });

if (!fs.existsSync(DIST)) {
  console.error("dist/ does not exist. Run `npm run build` first.");
  process.exit(1);
}

const clients = fs
  .readdirSync(CLIENTS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(CLIENTS_DIR, d.name, "client.json")))
  .map((d) => d.name)
  .sort();

const meta = Object.fromEntries(
  clients.map((c) => [c, JSON.parse(fs.readFileSync(path.join(CLIENTS_DIR, c, "client.json"), "utf8"))])
);

/** Every file under a directory, as paths relative to it. */
function walk(dir, rel = "") {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    const r = rel ? `${rel}/${e.name}` : e.name;
    e.isDirectory() ? out.push(...walk(p, r)) : out.push(r);
  }
  return out;
}

const built = Object.fromEntries(clients.map((c) => [c, walk(path.join(DIST, c))]));
const textOf = (c, f) => {
  try { return fs.readFileSync(path.join(DIST, c, f), "utf8"); } catch { return ""; }
};
const htmlFiles = (c) => built[c].filter((f) => f.endsWith(".html"));

/* ---------- 1. every client built ---------- */
{
  const missing = clients.filter((c) => !built[c].some((f) => f.endsWith(".html")));
  missing.length
    ? fail("Every client folder built", `no HTML for: ${missing.join(", ")}`)
    : pass("Every client folder built", `${clients.length} of ${clients.length}`);
}

/* ---------- 1b. the build is not STALE ----------
 * Learned the hard way: a failed build leaves the previous output in place, so every check below
 * can pass against a dist/ that no longer matches the source. Nothing here is trustworthy unless
 * the output is newer than the files it came from.
 */
{
  const newest = (dir) =>
    walk(dir).reduce((m, f) => Math.max(m, fs.statSync(path.join(dir, f)).mtimeMs), 0);
  const stale = [];
  for (const c of clients) {
    const src = newest(path.join(CLIENTS_DIR, c));
    const out = newest(path.join(DIST, c));
    if (!out || src > out) stale.push(c);
  }
  stale.length
    ? fail("Build is current, not stale", `source newer than output for: ${stale.join(", ")} - rebuild`)
    : pass("Build is current, not stale", "all outputs newer than their sources");
}

/* ---------- 1c. /<client>/ itself resolves ----------
 * The bare client path is the one the access rule has to cover and the one a client is actually
 * given. Without `slug: /` on a landing page the root is a 404 while every deeper page works, so
 * it is easy to ship and easy to miss.
 */
{
  const rootless = clients.filter((c) => !built[c].includes("index.html"));
  rootless.length
    ? fail("Client root page exists", `no index.html at the root of: ${rootless.join(", ")} (needs slug: / on a page)`)
    : pass("Client root page exists", `/<client>/ resolves for all ${clients.length}`);
}

/* ---------- 2. canary leak ----------
 * A canary is any CANARY-XXXX token written into a client's source docs. Ownership is taken from
 * the source tree, then every OTHER client's build output is searched for it. This is the
 * directional check: N clients give N x (N-1) meaningful comparisons.
 */
{
  /*
   * Ownership is a SET per token, not a single client. Taking the first client found made the
   * failure message name the wrong owner the moment a token appeared in two clients - which is
   * precisely the situation the check exists to catch. A token in two clients' SOURCE is itself a
   * failure: either someone copied another client's page, or two clients were given the same
   * token, and in both cases the leak check downstream is no longer meaningful.
   */
  const claims = new Map();
  for (const c of clients) {
    for (const f of walk(path.join(CLIENTS_DIR, c, "docs"))) {
      if (!/\.(md|mdx|json)$/i.test(f)) continue;
      const txt = fs.readFileSync(path.join(CLIENTS_DIR, c, "docs", f), "utf8");
      for (const m of txt.matchAll(/CANARY-[A-Z0-9][A-Z0-9-]*/g)) {
        if (!claims.has(m[0])) claims.set(m[0], new Set());
        claims.get(m[0]).add(c);
      }
    }
  }

  if (!claims.size) {
    fail("Canary leak", "no CANARY- tokens found in any client's docs, so nothing was proven");
  } else {
    const leaks = [];
    let comparisons = 0;
    for (const [token, owners] of claims) {
      if (owners.size > 1) {
        leaks.push(`${token} appears in the SOURCE of ${[...owners].join(" and ")}`);
        continue; // attribution is ambiguous, so the dist scan below would be misleading
      }
      const own = [...owners][0];
      for (const other of clients) {
        if (other === own) continue;
        comparisons++;
        const hit = htmlFiles(other).find((f) => textOf(other, f).includes(token));
        if (hit) leaks.push(`${token} (${own}'s) found in ${other}/${hit}`);
      }
      // and it must genuinely be in its OWN build, or the check proves nothing
      if (!htmlFiles(own).some((f) => textOf(own, f).includes(token))) {
        leaks.push(`${token} is missing from its own owner ${own} - check is not meaningful`);
      }
    }
    leaks.length
      ? fail("Canary leak", leaks.join("; "))
      : pass("Canary leak", `0 found across ${comparisons} directional checks, ${claims.size} tokens`);
  }
}

/* ---------- 3. another client's name or slug in this client's output ---------- */
{
  const leaks = [];
  for (const c of clients) {
    const others = clients.filter((o) => o !== c);
    for (const f of htmlFiles(c)) {
      const txt = textOf(c, f);
      for (const o of others) {
        // the slug appears legitimately nowhere in another client's pages; the display name
        // likewise. Checked case-insensitively because a title-cased mention still leaks.
        if (new RegExp(`/${o}/`, "i").test(txt)) leaks.push(`${c}/${f} references path /${o}/`);
        else if (new RegExp(`\\b${meta[o].name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(txt))
          leaks.push(`${c}/${f} mentions "${meta[o].name}"`);
      }
    }
  }
  leaks.length
    ? fail("Cross-client name or path reference", [...new Set(leaks)].slice(0, 8).join("; "))
    : pass("Cross-client name or path reference", "0 found");
}

/* ---------- 4. every asset URL sits under this client's own prefix ----------
 * The prefix has to match the one the site was BUILT with, not the one this process happens to
 * have in its environment. A build made with BASE_PREFIX=/docs-hub checked by a bare `npm run
 * verify` would otherwise report every URL on every page as a stray - hundreds of failures, all
 * of them the checker's fault. So it is read back out of the built HTML and only falls back to
 * the environment when nothing can be read.
 */
{
  /*
   * Read the prefix back out of the built HTML rather than trusting the environment, so a build
   * made with BASE_PREFIX set can be checked by a plain `npm run verify`.
   *
   * It comes from an emitted asset URL, not from a "baseUrl" key: Docusaurus does not write its
   * baseUrl into the page as a value. The only occurrences of that word are in the copy of its
   * own "base url issue" banner, which would have matched a naive search and returned nonsense.
   */
  const prefixOf = (c) => {
    const re = new RegExp(`(?:src|href)="((?:/[^"/]+)*?)/${c}/`);
    for (const f of htmlFiles(c)) {
      const m = textOf(c, f).match(re);
      if (m) return m[1]; // "" when the hub is served from the root
    }
    const raw = (process.env.BASE_PREFIX || "").trim();
    return raw === "" || raw === "/" ? "" : "/" + raw.replace(/^\/+|\/+$/g, "");
  };

  const strays = [];
  const seen = new Set();
  for (const c of clients) {
    const pfx = prefixOf(c);
    seen.add(pfx || "(none)");
    for (const f of htmlFiles(c)) {
      const txt = textOf(c, f);
      for (const m of txt.matchAll(/(?:src|href)="(\/[^"]*)"/g)) {
        const url = m[1];
        if (url.startsWith(`${pfx}/${c}/`)) continue;
        strays.push(`${c}/${f} -> ${url}  (expected under ${pfx}/${c}/)`);
      }
    }
  }
  strays.length
    ? fail("Assets namespaced under the client's own path", [...new Set(strays)].slice(0, 8).join("; "))
    : pass("Assets namespaced under the client's own path", `all, under ${[...seen].join(", ")}`);
}

/* ---------- 5. nothing sits at the shared root ---------- */
{
  const rootEntries = fs.readdirSync(DIST, { withFileTypes: true });
  const files = rootEntries.filter((e) => e.isFile()).map((e) => e.name);
  const dirs = rootEntries.filter((e) => e.isDirectory()).map((e) => e.name);
  const unexpectedDirs = dirs.filter((d) => !clients.includes(d));
  files.length || unexpectedDirs.length
    ? fail(
        "Shared root holds no files",
        [...files.map((f) => `file ${f}`), ...unexpectedDirs.map((d) => `dir ${d}/`)].join(", ")
      )
    : pass("Shared root holds no files", `0 files, ${dirs.length} client folders only`);
}

/* ---------- 6. internal/ never reaches a build ---------- */
{
  const internalDir = path.join(ROOT, "internal");
  const names = fs.existsSync(internalDir)
    ? walk(internalDir).map((f) => path.basename(f)).filter((n) => /\.(md|mdx)$/i.test(n))
    : [];
  const hits = [];
  for (const c of clients) {
    for (const n of names) {
      const stem = n.replace(/\.(md|mdx)$/i, "");
      if (built[c].some((f) => f.includes(`/${stem}/`) || f === `${stem}.html`))
        hits.push(`${c} published internal page "${stem}"`);
    }
  }
  hits.length
    ? fail("internal/ never published", hits.join("; "))
    : pass("internal/ never published", names.length ? `${names.length} staff pages, none built` : "no staff pages yet");
}

/* ---------- 7. every referenced image actually exists ----------
 * onBrokenLinks does not look at images, so this is the only thing standing between a typo and a
 * broken picture in a client's hands.
 */
{
  const missing = [];
  for (const c of clients) {
    for (const f of htmlFiles(c)) {
      for (const m of textOf(c, f).matchAll(/<img[^>]+src="([^"]+)"/g)) {
        const src = m[1];
        if (/^(https?:|data:)/.test(src)) continue;
        const relToDist = src.startsWith("/") ? src.slice(1) : path.posix.join(path.dirname(f), src);
        const onDisk = path.join(DIST, relToDist.startsWith(`${c}/`) ? relToDist : `${c}/${relToDist}`);
        if (!fs.existsSync(onDisk)) missing.push(`${c}/${f} -> ${src}`);
      }
    }
  }
  missing.length
    ? fail("Referenced images exist", [...new Set(missing)].slice(0, 8).join("; "))
    : pass("Referenced images exist", "all resolve");
}

/* ---------- 8. deep nesting really produces pages ---------- */
{
  const deep = [];
  for (const c of clients) {
    const d = built[c].filter((f) => f.endsWith("index.html") && f.split("/").length >= 4);
    if (d.length) deep.push(`${c}: ${d.length}`);
  }
  deep.length
    ? pass("Nested client -> project -> page routing", deep.join(", "))
    : fail("Nested client -> project -> page routing", "no page nested 3+ levels deep was built");
}

/* ---------- report ---------- */
const width = Math.max(...results.map((r) => r.name.length));
console.log("");
for (const r of results) {
  console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.name.padEnd(width)}  ${r.detail}`);
}
const failures = results.filter((r) => !r.ok).length;
console.log("");
console.log(`  ${results.length - failures}/${results.length} checks passed.`);
console.log("");
console.log("  NOT COVERED HERE: the access gate itself. These checks prove the published folders");
console.log("  are separate; they cannot prove Cloudflare Access is refusing the right people.");
console.log("  That needs the domain plus a second real email address - see internal/access-rules.md.");
process.exit(failures ? 1 : 0);
