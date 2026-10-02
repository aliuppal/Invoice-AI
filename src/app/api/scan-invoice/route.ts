import { NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { aiExtractInvoice, aiExtractionEnabled } from "@/lib/ai-extract";
import type { OcrResult, ScanResponse } from "@/lib/invoice";
import { ocrInvoiceImage } from "@/lib/ocr";
import { emptyParseResult, parseInvoiceText, type ParseResult } from "@/lib/parse-invoice";

// First OCR run downloads ~10 MB of language data; give cold starts room.
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;
const MIN_PROCESSING_MS = 1500;
const OCR_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/bmp", "image/gif"]);

// Budgets inside maxDuration so the client always gets a JSON response: Claude first, and if
// it fails or stalls there is still time for the Tesseract fallback.
const AI_TIMEOUT_MS = 35_000;
// OCR gets whatever is left of this, but never less than the minimum.
const TOTAL_BUDGET_MS = 55_000;
const MIN_OCR_TIMEOUT_MS = 15_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function withTimeout<T>(promise: Promise<T>, ms: number) {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`OCR timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function scanImage(image: Buffer, timeoutMs: number): Promise<{ ocr: OcrResult; parsed: ParseResult }> {
  try {
    return await withTimeout(ocrInvoiceImage(image), timeoutMs);
  } catch (error) {
    console.error("[scan-invoice] Tesseract OCR failed", error);
    return { ocr: { status: "failed", reason: "OCR engine could not read this image." }, parsed: emptyParseResult() };
  }
}

type Scan = { ocr: OcrResult; parsed: ParseResult; parser: ScanResponse["parser"] };

async function scanWithClaude(file: Buffer, mimeType: string): Promise<Scan> {
  const { parsed, transcript, model } = await withTimeout(aiExtractInvoice(file, mimeType), AI_TIMEOUT_MS);
  return { ocr: { status: "ok", method: "ai", model, text: transcript }, parsed, parser: "ai" };
}

async function pdfText(data: Uint8Array): Promise<OcrResult> {
  try {
    const pdf = await getDocumentProxy(data);
    const { text } = await extractText(pdf, { mergePages: true });
    if (text.trim()) return { status: "ok", method: "pdf", text };
    // Scanned PDFs are just page images; rasterising them for OCR is out of scope for the MVP.
    return { status: "skipped", reason: "This PDF has no text layer (it's a scan). Upload it as a PNG or JPG to run OCR." };
  } catch (error) {
    console.error("[scan-invoice] PDF text extraction failed", error);
    return { status: "failed", reason: "This PDF couldn't be read." };
  }
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data with a `file` field." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }
  if (!OCR_TYPES.has(file.type) && file.type !== "application/pdf") {
    return NextResponse.json({ error: "Unsupported file type. Upload a PNG, JPG, WEBP or PDF." }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File is larger than 10 MB." }, { status: 413 });
  }

  const startedAt = Date.now();
  const buffer = Buffer.from(await file.arrayBuffer());
  const isPdf = file.type === "application/pdf";
  let scan: Scan | null = null;

  // PDFs with a text layer parse reliably and for free; only scanned PDFs need a vision model.
  if (isPdf) {
    const ocr = await pdfText(new Uint8Array(buffer));
    if (ocr.status === "ok") scan = { ocr, parsed: parseInvoiceText(ocr.text), parser: "rules" };
    else if (!aiExtractionEnabled()) scan = { ocr, parsed: emptyParseResult(), parser: "rules" };
  }

  let aiFailure: string | null = null;
  if (!scan && aiExtractionEnabled()) {
    try {
      scan = await scanWithClaude(buffer, file.type);
    } catch (error) {
      console.error("[scan-invoice] Claude extraction failed", error);
      aiFailure = "Claude couldn't read this document, so the built-in OCR was used instead.";
    }
  }

  if (!scan) {
    scan = isPdf
      ? {
          ocr: { status: "failed", reason: "This scanned PDF couldn't be read. Upload it as a PNG or JPG." },
          parsed: emptyParseResult(),
          parser: "rules",
        }
      : {
          ...(await scanImage(buffer, Math.max(MIN_OCR_TIMEOUT_MS, TOTAL_BUDGET_MS - (Date.now() - startedAt)))),
          parser: "rules",
        };
  }

  const { data, missing } = scan.parsed;
  const warnings = aiFailure ? [aiFailure, ...scan.parsed.warnings] : scan.parsed.warnings;

  // Keep the response at >= 1.5s so the processing sequence reads as real work.
  await sleep(Math.max(0, MIN_PROCESSING_MS - (Date.now() - startedAt)));

  return NextResponse.json<ScanResponse>({ data, ocr: scan.ocr, parser: scan.parser, missing, warnings });
}
