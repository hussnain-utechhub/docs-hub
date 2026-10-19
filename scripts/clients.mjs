/*
 * Who do we have docs for?
 *
 * Prints the clients, their page counts and their URLs. It reads the folders and prints to your
 * terminal - it publishes nothing and adds nothing to any site. That is deliberate: a PAGE listing
 * every client would hand the whole customer list to anyone who found it, which on a public host
 * is worse than any single client's docs leaking. When the hub moves behind the access gate, a
 * staff-only index page becomes safe; until then, this is the admin view.
 *
 *   npm run clients
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, "clients");

const prefix = (() => {
  const raw = (process.env.BASE_PREFIX || "").trim();
  return raw === "" || raw === "/" ? "" : "/" + raw.replace(/^\/+|\/+$/g, "");
})();

const titleFromSlug = (s) =>
  s.split("-").filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

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

if (!fs.existsSync(DIR)) {
  console.log("No clients/ folder yet.");
  process.exit(0);
}

const rows = fs
  .readdirSync(DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
  .map((d) => d.name)
  .sort()
  .map((slug) => {
    const docs = path.join(DIR, slug, "docs");
    const cfgPath = path.join(DIR, slug, "client.json");
    let cfg = {};
    if (fs.existsSync(cfgPath)) { try { cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8")) || {}; } catch { cfg = { broken: true }; } }
    const hasDocs = fs.existsSync(docs);
    return {
      slug,
      name: cfg.name || titleFromSlug(slug),
      pages: hasDocs ? countMd(docs) : 0,
      hasDocs,
      // the front page is index.md, or any page carrying slug: /
      hasRoot: hasDocs && (fs.existsSync(path.join(docs, "index.md")) || fs.existsSync(path.join(docs, "index.mdx")) ||
        fs.readdirSync(docs).some((f) => /\.mdx?$/i.test(f) &&
          /^---[\s\S]*?\bslug:\s*\/\s*$/m.test(fs.readFileSync(path.join(docs, f), "utf8")))),
      broken: !!cfg.broken,
    };
  });

if (!rows.length) { console.log("No clients yet. `npm run new-client -- <folder> \"Name\"`"); process.exit(0); }

const w = Math.max(...rows.map((r) => r.slug.length), 6);
const wn = Math.max(...rows.map((r) => r.name.length), 4);
console.log("");
console.log("  " + "FOLDER".padEnd(w) + "  " + "NAME".padEnd(wn) + "  PAGES  URL");
for (const r of rows) {
  const notes = [];
  if (!r.hasDocs) notes.push("no docs/ - not built");
  else if (!r.pages) notes.push("docs/ is empty");
  else if (!r.hasRoot) notes.push("no index.md - its front page will 404");
  if (r.broken) notes.push("client.json is not valid JSON");
  console.log(
    "  " + r.slug.padEnd(w) + "  " + r.name.padEnd(wn) + "  " +
    String(r.pages).padStart(5) + "  " + prefix + "/" + r.slug + "/" +
    (notes.length ? "\n      ^ " + notes.join("; ") : "")
  );
}
const live = rows.filter((r) => r.hasDocs && r.pages);
console.log("");
console.log(`  ${live.length} client${live.length === 1 ? "" : "s"} will build${rows.length > live.length ? `, ${rows.length - live.length} skipped` : ""}.`);
console.log("");
