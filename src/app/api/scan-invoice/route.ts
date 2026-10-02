import { NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import type { OcrResult, ScanResponse } from "@/lib/invoice";
import { ocrInvoiceImage } from "@/lib/ocr";
import { emptyParseResult, parseInvoiceText, type ParseResult } from "@/lib/parse-invoice";

// First OCR run downloads ~10 MB of language data; give cold starts room.
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;
const MIN_PROCESSING_MS = 1500;
const OCR_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/bmp", "image/gif"]);

// Fail OCR well inside maxDuration so the client always gets a JSON response.
const OCR_TIMEOUT_MS = 45_000;

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
  const bytes = await file.arrayBuffer();
  let ocr: OcrResult;
  let parsed: ParseResult;
  if (file.type === "application/pdf") {
    ocr = await pdfText(new Uint8Array(bytes));
    parsed = ocr.status === "ok" ? parseInvoiceText(ocr.text) : emptyParseResult();
  } else {
    ({ ocr, parsed } = await scanImage(Buffer.from(bytes), OCR_TIMEOUT_MS));
  }
  const { data, missing, warnings } = parsed;

  // Keep the response at >= 1.5s so the processing sequence reads as real work.
  await sleep(Math.max(0, MIN_PROCESSING_MS - (Date.now() - startedAt)));

  return NextResponse.json<ScanResponse>({ data, ocr, parser: "rules", missing, warnings });
}
