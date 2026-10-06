// Stand-in for the Research documents screen in the single-file export: that screen needs the
// running app (Supabase connection, pdf.js worker, OCR language data), which a standalone HTML
// file cannot provide.
import { Guard, Top } from "@/components/cx/Shell";

export default function ResearchDocsNote() {
  return (
    <Guard screen="rdocs">
      <Top title="Research documents" sub="Register, upload and scan research papers · Draft → In review → Approved → Complete" />
      <div className="wrap">
        <div className="rd-mode local" style={{ maxWidth: 760 }}>
          <b>This screen needs the hosted app.</b> It stores records in the hospital&apos;s Supabase database and scans uploaded PDFs, Word,
          Excel and image files, which a standalone HTML file cannot do. Run the app (<code>npm run dev</code> in <code>web/</code>) to use it.
        </div>
      </div>
    </Guard>
  );
}
export const metadata = { title: "Research documents" };
