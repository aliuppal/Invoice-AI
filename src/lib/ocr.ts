// Server-only OCR pipeline: clean up the image, run Tesseract twice with different
// page-segmentation strategies, and merge what the parser finds in each pass.

import os from "node:os";
import sharp from "sharp";
import Tesseract from "tesseract.js";
import type { OcrResult } from "@/lib/invoice";
import { mergeParseResults, parseInvoiceText, type ParseResult } from "@/lib/parse-invoice";

// Tesseract wants ~300 dpi text. Screenshots and exported PNGs are often ~72 dpi, so scale
// every page to roughly this width (an A4/Letter page at ~300 dpi).
const TARGET_WIDTH = 2500;

// Sparse-text on a thresholded image reads header fields inside shaded table cells best;
// automatic layout on the greyscale image keeps table rows (line items) together.
// Order matters: earlier passes win ties when header fields are voted on.
const PASSES = [
  { psm: Tesseract.PSM.SPARSE_TEXT, threshold: 200 },
  { psm: Tesseract.PSM.AUTO, threshold: null },
] as const;

// Below this, letters are only a few pixels tall and even upscaled OCR guesses.
const MIN_RELIABLE_WIDTH = 800;

async function prepare(image: Buffer, width: number, threshold: number | null) {
  const scale = Math.min(4, Math.max(0.5, TARGET_WIDTH / width));
  let pipeline = sharp(image)
    .rotate() // honour EXIF orientation from phone cameras
    .flatten({ background: "#ffffff" })
    .resize({ width: Math.round(width * scale), kernel: "lanczos3" })
    .greyscale()
    .normalise();
  // Thresholding drops light-grey cell fills and watermarks behind the text.
  if (threshold !== null) pipeline = pipeline.threshold(threshold);
  return pipeline.png().toBuffer();
}

export async function ocrInvoiceImage(image: Buffer): Promise<{ ocr: OcrResult; parsed: ParseResult }> {
  // Serverless filesystems are read-only outside the temp dir, so cache language data there.
  const { width = TARGET_WIDTH } = await sharp(image).metadata();
  const worker = await Tesseract.createWorker("eng", Tesseract.OEM.LSTM_ONLY, { cachePath: os.tmpdir() });
  try {
    const passes: { text: string; confidence: number; parsed: ParseResult }[] = [];
    for (const pass of PASSES) {
      await worker.setParameters({
        tessedit_pageseg_mode: pass.psm,
        preserve_interword_spaces: "1",
        user_defined_dpi: "300",
      });
      const { data } = await worker.recognize(await prepare(image, width, pass.threshold));
      passes.push({ text: data.text, confidence: data.confidence, parsed: parseInvoiceText(data.text) });
    }

    // Show the layout pass to the user: it reads in document order.
    const layout = passes[passes.length - 1];
    const parsed = mergeParseResults(passes.map((p) => p.parsed));
    if (width < MIN_RELIABLE_WIDTH) {
      parsed.warnings.unshift(
        `This image is only ${width}px wide, so some text may be misread. A scan or photo at least 1500px wide reads far more reliably.`,
      );
    }
    return {
      ocr: { status: "ok", method: "ocr", confidence: Math.round(layout.confidence), text: layout.text },
      parsed,
    };
  } finally {
    await worker.terminate().catch(() => {});
  }
}
