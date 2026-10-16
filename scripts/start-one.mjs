/*
 * Serve ONE client's docs locally with live reload.
 *
 * One client at a time, deliberately: the dev server is the same single-client build the deploy
 * uses, so what you see locally is what that client gets. There is no "all clients" dev mode
 * because there is no all-clients site.
 *
 *   npm start -- acme-corp
 *   npm start -- acme-corp --port 3001
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CLIENTS_DIR = path.join(ROOT, "clients");

const args = process.argv.slice(2);
const client = args.find((a) => !a.startsWith("--"));
const passthrough = args.filter((a) => a.startsWith("--") || args[args.indexOf(a) - 1]?.startsWith("--"));

const available = fs.existsSync(CLIENTS_DIR)
  ? fs
      .readdirSync(CLIENTS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && fs.existsSync(path.join(CLIENTS_DIR, d.name, "client.json")))
      .map((d) => d.name)
      .sort()
  : [];

if (!client) {
  console.error("Which client? Usage: npm start -- <client>");
  console.error(available.length ? `Available: ${available.join(", ")}` : "No clients yet.");
  process.exit(1);
}
if (!available.includes(client)) {
  console.error(`No client folder named "${client}". Available: ${available.join(", ") || "none"}`);
  process.exit(1);
}

// Same .cmd-shim trap as the build script: spawn the JS entrypoint with node, not the bin shim.
const cli = path.join(ROOT, "node_modules", "@docusaurus", "core", "bin", "docusaurus.mjs");
if (!fs.existsSync(cli)) {
  console.error("Docusaurus is not installed. Run `npm install` first.");
  process.exit(1);
}

console.log(`Serving ${client} - the site will open at /${client}/`);
try {
  execFileSync(process.execPath, [cli, "start", ...passthrough], {
    cwd: ROOT,
    env: { ...process.env, CLIENT: client },
    stdio: "inherit",
  });
} catch {
  process.exit(1);
}
