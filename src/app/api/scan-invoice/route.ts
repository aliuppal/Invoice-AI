import os from "node:os";
import { NextResponse } from "next/server";
import Tesseract from "tesseract.js";
import { MOCK_EXTRACTION, type OcrResult, type ScanResponse } from "@/lib/invoice";

// First OCR run downloads ~10 MB of language data; give cold starts room.
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;
const MIN_PROCESSING_MS = 1500;
const OCR_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/bmp", "image/gif"]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
  let ocr: OcrResult;

  if (file.type === "application/pdf") {
    // Tesseract reads raster images only. Rendering PDF pages to images is out of scope for the MVP.
    ocr = { status: "skipped", reason: "PDF pages are not rasterised yet, so OCR was skipped." };
  } else {
    try {
      const image = Buffer.from(await file.arrayBuffer());
      // Serverless filesystems are read-only outside the temp dir, so cache language data there.
      const {
        data: { text, confidence },
      } = await Tesseract.recognize(image, "eng", { cachePath: os.tmpdir() });
      ocr = { status: "ok", confidence: Math.round(confidence), text };
    } catch (error) {
      console.error("[scan-invoice] Tesseract OCR failed", error);
      ocr = { status: "failed", reason: "OCR engine could not read this image." };
    }
  }

  // TODO: Replace mock with Regex/LLM parsing of the 'text' variable
  const data = structuredClone(MOCK_EXTRACTION);

  // Keep the response at >= 1.5s so the processing sequence reads as real work.
  await sleep(Math.max(0, MIN_PROCESSING_MS - (Date.now() - startedAt)));

  return NextResponse.json<ScanResponse>({ data, ocr, parser: "mock" });
}
