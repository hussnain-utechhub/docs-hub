/*
 * Scaffold a new client folder.
 *
 * This is a convenience, not a requirement - everything it does you could do in a file manager,
 * which is the point of the design. It exists so the folder name gets validated before it becomes
 * a public URL, and so nobody has to remember the shape of client.json.
 *
 * It writes ONLY inside clients/<name>/. It never touches a shared file, and it refuses to
 * overwrite an existing client.
 *
 *   npm run new-client -- acme-corp "Acme Corp"
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [slug, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(" ");

if (!slug || !name) {
  console.error('Usage: npm run new-client -- <folder-name> "Display Name"');
  console.error('Example: npm run new-client -- acme-corp "Acme Corp"');
  process.exit(1);
}

/*
 * The folder name becomes the public URL and the Cloudflare Access path, so it is checked here
 * rather than discovered later. Lower-case, digits and single hyphens only: anything else either
 * breaks the path rule or makes a URL that needs escaping.
 */
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
  console.error(`"${slug}" is not usable as a URL path.`);
  console.error("Use lower-case letters, digits and single hyphens: acme-corp, globex-ltd.");
  process.exit(1);
}

const dir = path.join(ROOT, "clients", slug);
if (fs.existsSync(dir)) {
  console.error(`clients/${slug}/ already exists - refusing to overwrite it.`);
  process.exit(1);
}

fs.mkdirSync(path.join(dir, "docs"), { recursive: true });
fs.writeFileSync(
  path.join(dir, "client.json"),
  JSON.stringify({ name, tagline: "" }, null, 2) + "\n",
  "utf8"
);
fs.writeFileSync(
  path.join(dir, "docs", "index.md"),
  `# ${name}

Documentation for ${name}.

Replace this page with whatever belongs first.

This file is called index.md, which is what makes it the front page - no front matter needed.
Folders under \`docs/\` become sections in the sidebar on their own, so there is no navigation
file to edit. Add .md files and they appear.
`,
  "utf8"
);

console.log(`Created clients/${slug}/`);
console.log(`  client.json      display name: ${name}`);
console.log(`  docs/index.md    the front page`);
console.log("");
console.log("Next:");
console.log(`  1. Write the docs in clients/${slug}/docs/`);
console.log(`  2. npm start -- ${slug}        preview it`);
console.log(`  3. Commit and push             the build deploys every client`);
console.log(`  4. ADD THE ACCESS RULE for /${slug}* before sharing the link.`);
console.log("     Until that rule exists the path is refused, which is the safe direction -");
console.log("     but it also means the client cannot open it. See internal/access-rules.md");
