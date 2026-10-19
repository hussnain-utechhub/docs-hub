/*
 * ONE shared site config, built once PER CLIENT.
 *
 * Nothing in here is client-specific. The client is chosen by the CLIENT env var and every
 * client-specific value is READ FROM THE CLIENT FOLDER. That is the whole point: adding a client
 * is adding a folder, never editing this file. If you ever find yourself adding an `if (CLIENT
 * === ...)` here, the design has been broken - put the value in that client's client.json instead.
 */
const fs = require("fs");
const path = require("path");

const CLIENT = process.env.CLIENT;
if (!CLIENT) {
  throw new Error(
    "CLIENT env var is required. Build through `npm run build`, or serve one client with " +
      "`npm start -- <client>` - never call docusaurus directly."
  );
}

const clientDir = path.join(__dirname, "clients", CLIENT);

/*
 * client.json is OPTIONAL, and so is every field in it.
 *
 * The whole point of this hub is that adding a client is adding a folder of Markdown. Demanding a
 * config file first would have made the simplest possible case - drop some .md files in - fail with
 * an error about JSON, which is exactly the friction this design exists to avoid. So the display
 * name falls back to the folder name, tidied up: acme-corp becomes "Acme Corp".
 *
 * Write a client.json only when the folder name is not the name you want shown, or to add a
 * tagline.
 */
const titleFromSlug = (s) =>
  s.split("-").filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

const configPath = path.join(clientDir, "client.json");
let meta = {};
if (fs.existsSync(configPath)) {
  try {
    meta = JSON.parse(fs.readFileSync(configPath, "utf8")) || {};
  } catch (e) {
    // A typo in the JSON must name the file, or you are hunting a parse error with no context.
    throw new Error(`clients/${CLIENT}/client.json is not valid JSON: ${e.message}`);
  }
}
if (!meta.name) meta.name = titleFromSlug(CLIENT);

/*
 * baseUrl is what makes a per-path access rule airtight. Serving this client from /<client>/ puts
 * its pages AND every asset it emits under that one prefix, so a Cloudflare Access rule on
 * /<client>* covers the whole site. Serve two clients from / and their assets would collide in
 * one namespace, and a rule could not separate them.
 *
 * BASE_PREFIX is the directory the whole hub hangs under, and it is the setting people forget.
 * A GitHub Pages PROJECT site serves from /<repo>/, so the hub lives at /docs-hub/ and this client
 * at /docs-hub/<client>/. A custom domain serves from the root, so the prefix is empty. Get it
 * wrong and every asset resolves one directory too high: the pages still build, still deploy, and
 * render unstyled or 404 with no error anywhere to explain it.
 *
 * It is normalised rather than trusted: "docs-hub", "/docs-hub" and "/docs-hub/" all mean the same
 * thing, and a value typed either way should not change what gets built.
 *
 * SITE_URL is only the ORIGIN (https://user.github.io). It has no effect on where files land -
 * only on absolute URLs in metadata - so a wrong value there cannot leak one client into another.
 */
const rawPrefix = (process.env.BASE_PREFIX || "").trim();
const PREFIX = rawPrefix === "" || rawPrefix === "/" ? "" : "/" + rawPrefix.replace(/^\/+|\/+$/g, "");

module.exports = {
  title: meta.name,
  tagline: meta.tagline || "",
  url: process.env.SITE_URL || "https://docs.example.com",
  baseUrl: PREFIX + "/" + CLIENT + "/",
  favicon: "img/favicon.svg",

  // Fail the build on a broken internal link rather than shipping it.
  //
  // Images: Docusaurus 3 DOES fail on a broken MARKDOWN image - ![x](./missing.png) - through
  // markdown.hooks.onBrokenMarkdownImages, which defaults to throwing. What it does not check is a
  // raw <img src="..."> tag, so scripts/verify.mjs checks those against the built output.
  onBrokenLinks: "throw",
  onDuplicateRoutes: "throw",

  // Under markdown.hooks, not top level: the top-level onBrokenMarkdownLinks is
  // deprecated in Docusaurus 3 and is removed in 4.
  markdown: { hooks: { onBrokenMarkdownLinks: "throw" } },

  // Client documentation is not for search engines. The gate is the real control; this is the
  // belt-and-braces layer for anything that slips in front of it, such as a preview deployment.
  // NOTE: if you later add a local search plugin, noIndex empties its index unless the plugin is
  // given forceIgnoreNoIndex. That has bitten this stack before.
  noIndex: true,

  // Directory-style URLs, so /intro and /intro/ both resolve on a static host.
  trailingSlash: true,

  i18n: { defaultLocale: "en", locales: ["en"] },

  presets: [
    [
      "classic",
      {
        docs: {
          // Read from the client's own folder. The build never sees any other client's files.
          path: path.join(clientDir, "docs"),
          routeBasePath: "/",
          sidebarPath: require.resolve("./sidebars.js"),
          showLastUpdateTime: true,
        },
        blog: false,
        pages: false,
        theme: { customCss: require.resolve("./src/css/custom.css") },
        sitemap: false, // a sitemap only helps crawlers, and these sites are not for crawling
      },
    ],
  ],

  themeConfig: {
    colorMode: { defaultMode: "light", respectPrefersColorScheme: true },
    navbar: {
      title: meta.name,
      logo: meta.logo ? { alt: meta.name, src: meta.logo } : undefined,
      items: [],
    },
    footer: {
      style: "dark",
      copyright: `${meta.name}${meta.footerNote ? " · " + meta.footerNote : ""}`,
    },
    docs: { sidebar: { hideable: true } },
  },
};
