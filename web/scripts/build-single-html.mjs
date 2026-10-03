// Builds the whole prototype into ONE self-contained HTML file (no server needed):
//   npm run build:html   →   ../dist/vascular-care-prototype.html
// JS: esbuild bundle of scripts/single-html/app.tsx (next/link + next/navigation shimmed, hash routes).
// CSS: the Tailwind + clinical CSS from the latest `next build`, with fonts inlined as data URIs.

import { build } from "esbuild";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const web = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(web, "..", "dist", "vascular-care-prototype.html");
const shim = (f) => join(web, "scripts", "single-html", "shims", f);

// ---- JS
const js = await build({
  entryPoints: [join(web, "scripts", "single-html", "app.tsx")],
  bundle: true, write: false, format: "iife", platform: "browser", target: "es2022", minify: true,
  jsx: "automatic", tsconfig: join(web, "tsconfig.json"), legalComments: "none", logLevel: "warning",
  define: { "process.env.NODE_ENV": '"production"' },
  alias: { "next/link": shim("next-link.tsx"), "next/navigation": shim("next-navigation.ts") },
  loader: { ".css": "empty" },
});
const code = js.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");

// ---- CSS from the Next build (run `next build` first)
const chunks = join(web, ".next", "static", "chunks"), media = join(web, ".next", "static", "media");
const cssFiles = readdirSync(chunks).filter((f) => f.endsWith(".css")).map((f) => join(chunks, f)).sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs);
if (!cssFiles.length) throw new Error("No CSS in .next/static/chunks — run `npm run build` first.");
let css = cssFiles.map((f) => readFileSync(f, "utf8")).join("\n");
css = css.replace(/url\(\.\.\/media\/([^)]+)\)/g, (_, name) => `url(data:font/woff2;base64,${readFileSync(join(media, name)).toString("base64")})`);
const fontVars = [...new Set(css.match(/\.[\w-]*geist[\w-]*__variable/gi) ?? [])].map((c) => c.slice(1)).join(" ");

const html = `<!doctype html>
<html lang="en" class="${fontVars} h-full antialiased">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Northbridge Vascular Prototype</title>
<meta name="description" content="Single-file prototype: public site, staff walk-in flow and clinical workspace (registration, nursing assessment, doctor consultation). Demo data only.">
<style>${css}</style>
</head>
<body class="flex min-h-full flex-col font-sans">
<div id="root" style="display:contents"></div>
<noscript>This prototype needs JavaScript.</noscript>
<script>${code}</script>
</body>
</html>
`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);

// Variant for publishing as a claude.ai Artifact: the host supplies <html>/<head>/<body>,
// so the root classes are applied by a tiny script and the <title> comes first.
const artifact = `<title>Northbridge Vascular Prototype</title>
<style>${css}</style>
<script>document.documentElement.className+=" ${fontVars} h-full antialiased";document.body.className+=" flex min-h-full flex-col font-sans";</script>
<div id="root" style="display:contents"></div>
<script>${code}</script>
`;
writeFileSync(out.replace(/\.html$/, ".artifact.html"), artifact);
console.log(`Wrote ${out} (${(html.length / 1024 / 1024).toFixed(2)} MB; JS ${(code.length / 1024).toFixed(0)} KB, CSS ${(css.length / 1024).toFixed(0)} KB)`);
