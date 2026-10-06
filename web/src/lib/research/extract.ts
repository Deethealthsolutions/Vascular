"use client";

// Turns an uploaded research file into text, in the browser.
//   PDF            text layer via pdf.js; pages without text are rendered and OCR'd (scanned PDFs)
//   DOCX           mammoth raw text
//   DOC (legacy)   best-effort recovery of text runs from the binary file — flagged for review
//   XLS / XLSX/CSV every sheet as CSV via SheetJS
//   PNG/JPG/BMP    OCR via tesseract.js (English)
//   TXT            as is
// Heavy libraries load only when a file of that type is scanned.

export type Extraction = { text: string; method: string; pages: number | null; confidence: number | null; warnings: string[] };
export type Progress = (message: string, pct: number) => void;

const ext = (name: string) => (name.split(".").pop() ?? "").toLowerCase();
export const kindOf = (name: string) => {
  const e = ext(name);
  if (e === "pdf") return "PDF";
  if (e === "doc" || e === "docx") return "Word";
  if (e === "xls" || e === "xlsx" || e === "csv") return "Excel";
  if (["png", "jpg", "jpeg", "bmp"].includes(e)) return "Image";
  if (e === "txt") return "Text";
  return "Other";
};

export async function sha256(buf: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function extractText(file: File, progress: Progress = () => {}): Promise<Extraction> {
  const e = ext(file.name);
  if (e === "pdf") return pdf(file, progress);
  if (e === "docx") return docx(file, progress);
  if (e === "doc") return legacyDoc(file, progress);
  if (e === "xls" || e === "xlsx" || e === "csv") return sheet(file, progress);
  if (["png", "jpg", "jpeg", "bmp"].includes(e)) return image(file, progress);
  if (e === "txt") return { text: await file.text(), method: "Plain text", pages: null, confidence: null, warnings: [] };
  throw new Error(`.${e} files are not supported. Use PDF, Word, Excel or an image.`);
}

// ------------------------------------------------------------------ OCR

type OcrWorker = { recognize: (img: HTMLCanvasElement | Blob) => Promise<{ data: { text: string; confidence: number } }>; terminate: () => Promise<unknown> };

async function ocrWorker(progress: Progress, label: string): Promise<OcrWorker> {
  progress(`Loading the text-recognition engine…`, 3);
  const { createWorker } = await import("tesseract.js");
  return (await createWorker("eng", 1, {
    logger: (m: { status: string; progress: number }) => { if (m.status === "recognizing text") progress(`${label} — reading text`, Math.round(m.progress * 100)); },
  })) as unknown as OcrWorker;
}

async function toCanvas(file: Blob): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file);
  const c = document.createElement("canvas");
  c.width = bmp.width; c.height = bmp.height;
  c.getContext("2d")!.drawImage(bmp, 0, 0);
  bmp.close();
  return c;
}

async function image(file: File, progress: Progress): Promise<Extraction> {
  const w = await ocrWorker(progress, "Image");
  try {
    const canvas = await toCanvas(file); // handles BMP and other formats the browser can decode
    const { data } = await w.recognize(canvas);
    const warnings = data.confidence < 70 ? [`Low recognition confidence (${Math.round(data.confidence)}%) — check the text against the image.`] : [];
    return { text: data.text.trim(), method: "OCR (image)", pages: 1, confidence: Math.round(data.confidence), warnings };
  } finally {
    await w.terminate();
  }
}

// ------------------------------------------------------------------ PDF

async function pdf(file: File, progress: Progress): Promise<Extraction> {
  progress("Opening the PDF…", 2);
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  const scanned: number[] = [];
  let worker: OcrWorker | null = null;
  const conf: number[] = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      progress(`Page ${i} of ${doc.numPages} — text layer`, Math.round(((i - 1) / doc.numPages) * 100));
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      let text = tc.items.map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : " ") : "")).join("").replace(/[ \t]+\n/g, "\n").trim();
      if (text.replace(/\s/g, "").length < 25) {
        // No usable text layer: a scanned page. Render it and OCR the image.
        scanned.push(i);
        worker ??= await ocrWorker(progress, `Page ${i}`);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width; canvas.height = viewport.height;
        await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport }).promise;
        progress(`Page ${i} of ${doc.numPages} — scanned page, reading text`, Math.round(((i - 1) / doc.numPages) * 100));
        const { data } = await worker.recognize(canvas);
        text = data.text.trim();
        conf.push(data.confidence);
      }
      pages.push(text);
    }
  } finally {
    if (worker) await worker.terminate();
  }
  const confidence = conf.length ? Math.round(conf.reduce((a, b) => a + b, 0) / conf.length) : null;
  const warnings = [
    scanned.length ? `${scanned.length} scanned page${scanned.length > 1 ? "s" : ""} (${scanned.join(", ")}) read by OCR${confidence != null ? ` at ${confidence}% confidence` : ""} — check against the original.` : "",
  ].filter(Boolean);
  return {
    text: pages.map((t, i) => (doc.numPages > 1 ? `--- Page ${i + 1} ---\n${t}` : t)).join("\n\n"),
    method: scanned.length === doc.numPages ? "OCR (scanned PDF)" : scanned.length ? "PDF text + OCR" : "PDF text layer",
    pages: doc.numPages, confidence, warnings,
  };
}

// ------------------------------------------------------------------ Word

async function docx(file: File, progress: Progress): Promise<Extraction> {
  progress("Reading the Word document…", 30);
  const mammoth = await import("mammoth");
  const r = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return { text: r.value.replace(/\n{3,}/g, "\n\n").trim(), method: "Word (.docx)", pages: null, confidence: null, warnings: r.messages.map((m) => m.message).slice(0, 3) };
}

/** Legacy binary .doc: recover readable runs (UTF-16 and 8-bit). Formatting and some text may be lost. */
async function legacyDoc(file: File, progress: Progress): Promise<Extraction> {
  progress("Recovering text from the legacy Word file…", 40);
  const b = new Uint8Array(await file.arrayBuffer());
  const runs: string[] = [];
  // UTF-16LE runs (Word 97+ stores most text this way)
  let cur = "";
  for (let i = 0; i + 1 < b.length; i += 2) {
    const c = b[i] | (b[i + 1] << 8);
    if ((c >= 32 && c < 0xd800 && c !== 0xfffd) || c === 13 || c === 10 || c === 9) cur += c === 13 ? "\n" : String.fromCharCode(c);
    else { if (cur.replace(/\s/g, "").length >= 12) runs.push(cur); cur = ""; }
  }
  if (cur.replace(/\s/g, "").length >= 12) runs.push(cur);
  let text = runs.join("\n").replace(/[^\S\n]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (text.length < 40) {
    // fall back to 8-bit runs
    text = (new TextDecoder("latin1").decode(b).match(/[\x20-\x7e\r\n\t]{12,}/g) ?? []).join("\n").replace(/\r/g, "\n").trim();
  }
  return { text, method: "Word (.doc, recovered)", pages: null, confidence: null, warnings: ["Legacy .doc format: text recovered approximately — headers, tables and some characters may be missing. Save as .docx or PDF for a clean scan."] };
}

// ------------------------------------------------------------------ Excel

async function sheet(file: File, progress: Progress): Promise<Extraction> {
  progress("Reading the spreadsheet…", 30);
  const XLSX = await import("xlsx");
  const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: "array" });
  const parts = wb.SheetNames.map((n) => `## Sheet: ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n], { blankrows: false })}`);
  return { text: parts.join("\n\n").trim(), method: `Spreadsheet (${wb.SheetNames.length} sheet${wb.SheetNames.length > 1 ? "s" : ""})`, pages: wb.SheetNames.length, confidence: null, warnings: [] };
}
