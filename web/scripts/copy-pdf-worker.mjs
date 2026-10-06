// Copies the pdf.js worker into public/ so the browser can load it from the app's own origin.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const web = join(dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(join(web, "public", "pdfjs"), { recursive: true });
copyFileSync(join(web, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs"), join(web, "public", "pdfjs", "pdf.worker.min.mjs"));
console.log("pdf.js worker copied to public/pdfjs/");
