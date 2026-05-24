// Extract plain text from a resume file (PDF or plain text).
// Returns empty string for unsupported formats.
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore — vite handles ?url import for worker
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorker;

export async function extractResumeText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (file.type === "text/plain" || name.endsWith(".txt")) {
    return await file.text();
  }
  if (file.type === "application/pdf" || name.endsWith(".pdf")) {
    try {
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      let out = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const tc = await page.getTextContent();
        out += tc.items.map((it: any) => it.str).join(" ") + "\n";
      }
      return out.trim();
    } catch (e) {
      console.error("PDF extract failed", e);
      return "";
    }
  }
  return "";
}
