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
const configPath = path.join(clientDir, "client.json");
if (!fs.existsSync(configPath)) {
  throw new Error(`clients/${CLIENT}/client.json not found - every client needs one.`);
}
const meta = JSON.parse(fs.readFileSync(configPath, "utf8"));
if (!meta.name) throw new Error(`clients/${CLIENT}/client.json must have a "name".`);

/*
 * baseUrl is what makes a per-path access rule airtight. Serving this client from /<client>/ puts
 * its pages AND every asset it emits under that one prefix, so a Cloudflare Access rule on
 * /<client>* covers the whole site. Serve two clients from / and their assets would collide in
 * one namespace, and a rule could not separate them.
 *
 * SITE_URL has no effect on where files land - only on absolute URLs in sitemap and metadata -
 * so a wrong value here cannot leak one client into another's build.
 */
module.exports = {
  title: meta.name,
  tagline: meta.tagline || "",
  url: process.env.SITE_URL || "https://docs.example.com",
  baseUrl: "/" + CLIENT + "/",
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
