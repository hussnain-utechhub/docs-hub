/*
 * Builds EVERY client folder into its own isolated site under dist/<client>/.
 *
 * Discovery is by convention: anything in clients/ with a docs/ folder is a client. Not "anything
 * with a client.json" - that file is optional, and requiring it would mean the simplest case,
 * dropping some .md files into a new folder, failed with an error about JSON. There is no registry
 * to update, so adding a client really is just adding a folder.
 *
 * A folder starting with _ is skipped, which gives a way to park a client without deleting it.
 *
 * Each client is a SEPARATE Docusaurus build, not one site with many sections. That is the
 * decision the whole privacy story rests on: a client's output folder contains only that client's
 * pages and assets, so even a mis-scoped access rule cannot serve another client's content -
 * there is nothing of theirs in the folder to leak. Docusaurus's own "multi-instance" docs mode
 * would put every client in one build, and was rejected for exactly this reason.
 *
 *   node scripts/build-all.mjs              build every client
 *   node scripts/build-all.mjs acme-corp    build one
 *   node scripts/build-all.mjs --keep       do not wipe dist/ first
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath, not new URL().pathname - the latter leaves %20 for a space in the path, and this
// repo may well sit under a folder with one.
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CLIENTS_DIR = path.join(ROOT, "clients");
const DIST = path.join(ROOT, "dist");

const args = process.argv.slice(2);
const keep = args.includes("--keep");
const only = args.find((a) => !a.startsWith("--"));

export function listClients(root = ROOT) {
  const dir = path.join(root, "clients");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((n) => !n.startsWith("_"))
    .filter((n) => fs.existsSync(path.join(dir, n, "docs")))
    .sort();
}

const all = listClients();
const clients = all.filter((n) => !only || n === only);

if (!all.length) {
  console.error("No clients found. A client is a folder under clients/ with a docs/ folder in it.");
  process.exit(1);
}
if (!clients.length) {
  console.error(`No client folder named "${only}". Found: ${all.join(", ")}`);
  process.exit(1);
}

// A client folder with no docs/ would build an empty site that looks fine and says nothing, so
// refuse it here rather than publish it.
for (const c of clients) {
  const d = path.join(CLIENTS_DIR, c, "docs");
  if (!fs.existsSync(d) || !fs.readdirSync(d).length) {
    console.error(`clients/${c}/docs/ is missing or empty - nothing to build.`);
    process.exit(1);
  }
}

if (!keep && !only) fs.rmSync(DIST, { recursive: true, force: true });

/*
 * Call the CLI's JS entrypoint with node rather than the node_modules/.bin shim. On Windows that
 * shim is a .cmd, which execFileSync cannot spawn without shell:true - it fails with EINVAL and
 * NO output, so every client reports a failure with no error text and it reads like a content
 * problem when the build never started at all.
 */
const cli = path.join(ROOT, "node_modules", "@docusaurus", "core", "bin", "docusaurus.mjs");
if (!fs.existsSync(cli)) {
  console.error("Docusaurus is not installed. Run `npm install` first.");
  process.exit(1);
}

const started = Date.now();
const failed = [];
for (const [i, client] of clients.entries()) {
  const outDir = path.join(DIST, client);
  process.stdout.write(`\n=== [${i + 1}/${clients.length}] ${client} -> dist/${client}/ ===\n`);
  try {
    execFileSync(process.execPath, [cli, "build", "--out-dir", outDir], {
      cwd: ROOT,
      env: { ...process.env, CLIENT: client },
      stdio: "inherit",
    });
  } catch {
    console.error(`FAILED: ${client}`);
    failed.push(client);
  }
}

const secs = ((Date.now() - started) / 1000).toFixed(1);
console.log(`\nBuilt ${clients.length - failed.length}/${clients.length} client sites in ${secs}s.`);
if (failed.length) console.error(`Failed: ${failed.join(", ")}`);
console.log("Next: `npm run verify` checks that no client's build contains another's content.");
process.exit(failed.length ? 1 : 0);
