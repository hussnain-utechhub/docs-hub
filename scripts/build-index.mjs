/*
 * The staff index: one page at the root listing every client.
 *
 * OFF BY DEFAULT, and that is the important part. This page is the only thing in the whole hub
 * that knows every client exists. Any single client's docs leaking is bad; this page leaking hands
 * over the entire customer list in one request. So it is built only when STAFF_INDEX is set, in
 * the same deny-by-default spirit as PUBLISH_TARGET - nobody can publish it by forgetting
 * something.
 *
 * On the gated host it is safe, because the broad staff rule covers the root:
 *
 *     docs.yourfirm.com/acme-corp*  ->  @acme.com          (specific rules first)
 *     docs.yourfirm.com/*           ->  @yourfirm.com      (staff rule LAST)
 *
 * On the current public GitHub Pages target there is no gate at all, so switching this on there is
 * a deliberate choice that only makes sense while every client is a fictional demo.
 *
 * It is written as a standalone HTML file rather than a Docusaurus site on purpose: it must never
 * be part of any client's build, and the surest way to guarantee that is for it to share no code,
 * no assets and no build step with them.
 *
 *   STAFF_INDEX=1 node scripts/build-index.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CLIENTS_DIR = path.join(ROOT, "clients");
const DIST = path.join(ROOT, "dist");

const prefix = (() => {
  const raw = (process.env.BASE_PREFIX || "").trim();
  return raw === "" || raw === "/" ? "" : "/" + raw.replace(/^\/+|\/+$/g, "");
})();

const titleFromSlug = (s) =>
  s.split("-").filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

// HTML-escape everything that comes out of a folder name or a client.json. A client called
// "Smith & Co <Ltd>" must not be able to break the page it is listed on.
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const countMd = (dir) => {
  let n = 0;
  (function rec(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) rec(p);
      else if (/\.mdx?$/i.test(e.name)) n++;
    }
  })(dir);
  return n;
};

export function collect() {
  if (!fs.existsSync(CLIENTS_DIR)) return [];
  return fs
    .readdirSync(CLIENTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name)
    .filter((slug) => fs.existsSync(path.join(CLIENTS_DIR, slug, "docs")))
    .sort()
    .map((slug) => {
      const cfgPath = path.join(CLIENTS_DIR, slug, "client.json");
      let cfg = {};
      if (fs.existsSync(cfgPath)) { try { cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8")) || {}; } catch { cfg = {}; } }
      return {
        slug,
        name: cfg.name || titleFromSlug(slug),
        tagline: cfg.tagline || "",
        pages: countMd(path.join(CLIENTS_DIR, slug, "docs")),
      };
    })
    .filter((c) => c.pages > 0);
}

function render(clients) {
  const rows = clients
    .map(
      (c) => `      <li>
        <a class="c" href="${esc(prefix)}/${esc(c.slug)}/">
          <span class="n">${esc(c.name)}</span>
          ${c.tagline ? `<span class="t">${esc(c.tagline)}</span>` : ""}
          <span class="m">${c.pages} page${c.pages === 1 ? "" : "s"} &middot; /${esc(c.slug)}/</span>
        </a>
      </li>`
    )
    .join("\n");

  const n = clients.length;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- This page lists every client. It must never be indexed. -->
<meta name="robots" content="noindex, nofollow, noarchive">
<title>Client documentation</title>
<style>
  :root {
    --ink: #10151c; --dim: #5b6676; --line: #e3e8ef; --bg: #f7f9fc;
    --card: #ffffff; --accent: #1b6fe0;
  }
  @media (prefers-color-scheme: dark) {
    :root { --ink:#e8edf4; --dim:#97a3b4; --line:#273140; --bg:#0e1319; --card:#151c25; --accent:#6aa9f0; }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--ink);
    font: 16px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 780px; margin: 0 auto; padding: 56px 16px 72px; }
  h1 { font-size: 1.6rem; margin: 0 0 6px; letter-spacing: -0.01em; }
  .sub { color: var(--dim); margin: 0 0 28px; font-size: 0.95rem; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
  .c {
    display: grid; gap: 2px; padding: 16px 18px; text-decoration: none; color: inherit;
    background: var(--card); border: 1px solid var(--line); border-radius: 10px;
  }
  .c:hover { border-color: var(--accent); }
  .c:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .n { font-weight: 600; }
  .t { color: var(--dim); font-size: 0.9rem; }
  .m { color: var(--dim); font-size: 0.8rem; font-variant-numeric: tabular-nums; margin-top: 4px; }
  .note {
    margin-top: 32px; padding: 12px 14px; border-left: 3px solid var(--accent);
    background: var(--card); color: var(--dim); font-size: 0.85rem; border-radius: 0 6px 6px 0;
  }
  .empty { color: var(--dim); padding: 24px 0; }
</style>
</head>
<body>
  <main class="wrap">
    <h1>Client documentation</h1>
    <p class="sub">${n} client${n === 1 ? "" : "s"}. Staff view &mdash; each client sees only their own.</p>
${n ? `    <ul>\n${rows}\n    </ul>` : `    <p class="empty">No clients yet.</p>`}
    <p class="note">This page lists every client, so it belongs behind the staff access rule. On a
    host with no gate it is readable by anyone who finds it.</p>
  </main>
</body>
</html>
`;
}

const enabled = ["1", "true", "yes", "on"].includes(String(process.env.STAFF_INDEX || "").toLowerCase());

if (!enabled) {
  console.log("Staff index: OFF (set STAFF_INDEX=1 to build it). Nothing written to dist/.");
  process.exit(0);
}
if (!fs.existsSync(DIST)) {
  console.error("dist/ does not exist - build the clients first.");
  process.exit(1);
}

const clients = collect();
fs.writeFileSync(path.join(DIST, "index.html"), render(clients), "utf8");
console.log(`Staff index: wrote dist/index.html listing ${clients.length} client(s) at ${prefix || ""}/`);
