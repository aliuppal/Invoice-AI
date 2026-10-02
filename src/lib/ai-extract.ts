// Server-only invoice extraction with Claude vision: send the page image (or a scanned PDF)
// and get the invoice fields back as schema-validated JSON. Used when ANTHROPIC_API_KEY is set.

import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { round2, type ExtractedInvoice } from "@/lib/invoice";
import { finalizeExtraction, parseDate, type ParseResult } from "@/lib/parse-invoice";

const MODEL = "claude-opus-5-5";

// Image types the Messages API accepts as-is; anything else (e.g. BMP) is re-encoded to PNG.
const API_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
// Keep requests well under the API's per-image size and dimension limits.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_EDGE = 2576;

const SYSTEM_PROMPT = `You extract data from supplier invoices and purchase orders for posting into SAP.
Read the document exactly as printed. Never invent values: use an empty string (or null where allowed) for anything that isn't on the document.
- vendor: the issuing supplier's company name (the "From"/seller, not the "Bill to"/customer).
- invoice_number / po_number: copy exactly, including prefixes. "Order Number" or "Purchase Order" counts as the PO number.
- invoice_date: the issue date as YYYY-MM-DD (not the due date).
- currency: ISO 4217 code; infer from symbols or the issuer's address when no code is printed.
- line_items: one entry per billed row. quantity and unit_price are numbers; unit_price is per unit, after any line discount.
- tax: total tax amount (0 if none). document_subtotal / document_total: exactly as printed, or null.
- transcript: the document's text, line by line in reading order.
- notes: short notes on anything illegible or ambiguous; empty when everything was clear.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "vendor",
    "invoice_number",
    "invoice_date",
    "po_number",
    "currency",
    "line_items",
    "tax",
    "document_subtotal",
    "document_total",
    "transcript",
    "notes",
  ],
  properties: {
    vendor: { type: "string" },
    invoice_number: { type: "string" },
    invoice_date: { type: "string", description: "YYYY-MM-DD, or empty" },
    po_number: { type: "string" },
    currency: { type: "string", description: "ISO 4217 code, e.g. USD" },
    line_items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["description", "quantity", "unit_price"],
        properties: {
          description: { type: "string" },
          quantity: { type: "number" },
          unit_price: { type: "number" },
        },
      },
    },
    tax: { type: "number" },
    document_subtotal: { type: ["number", "null"] },
    document_total: { type: ["number", "null"] },
    transcript: { type: "string" },
    notes: { type: "array", items: { type: "string" } },
  },
};

type AiInvoice = {
  vendor: string;
  invoice_number: string;
  invoice_date: string;
  po_number: string;
  currency: string;
  line_items: { description: string; quantity: number; unit_price: number }[];
  tax: number;
  document_subtotal: number | null;
  document_total: number | null;
  transcript: string;
  notes: string[];
};

export function aiExtractionEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | undefined;
function getClient() {
  // A key that isn't scoped to one workspace needs the workspace named on every request.
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID;
  client ??= new Anthropic({
    maxRetries: 1,
    timeout: 40_000,
    defaultHeaders: workspace ? { "anthropic-workspace-id": workspace } : undefined,
  });
  return client;
}

async function imageBlock(image: Buffer, mimeType: string): Promise<Anthropic.Beta.BetaImageBlockParam> {
  const { width = 0, height = 0 } = await sharp(image).metadata();
  const fits = API_IMAGE_TYPES.has(mimeType) && image.length <= MAX_IMAGE_BYTES && Math.max(width, height) <= MAX_EDGE;
  if (fits) {
    const media_type = mimeType as "image/png" | "image/jpeg" | "image/webp" | "image/gif";
    return { type: "image", source: { type: "base64", media_type, data: image.toString("base64") } };
  }
  const png = await sharp(image)
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
  return { type: "image", source: { type: "base64", media_type: "image/png", data: png.toString("base64") } };
}

export async function aiExtractInvoice(
  file: Buffer,
  mimeType: string,
): Promise<{ parsed: ParseResult; transcript: string; model: string }> {
  const document: Anthropic.Beta.BetaContentBlockParam =
    mimeType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: file.toString("base64") } }
      : await imageBlock(file, mimeType);

  const response = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    // On a safety decline, Anthropic re-runs the request on its recommended fallback model.
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [document, { type: "text", text: "Extract this invoice." }],
      },
    ],
  });

  if (response.stop_reason === "refusal") throw new Error("Claude declined to read this document.");
  if (response.stop_reason === "max_tokens") throw new Error("Claude's response was cut off.");
  const text = response.content.find((block) => block.type === "text");
  if (!text || text.type !== "text") throw new Error("Claude returned no extraction.");

  const ai = JSON.parse(text.text) as AiInvoice;
  const data: ExtractedInvoice = {
    vendor: ai.vendor.trim(),
    invoice_number: ai.invoice_number.trim(),
    // Normalise whatever date format came back; drop it if it isn't a real date.
    invoice_date: parseDate(ai.invoice_date) ?? "",
    po_number: ai.po_number.trim(),
    currency: ai.currency.trim().toUpperCase() || "USD",
    line_items: ai.line_items
      .filter((item) => item.description.trim() || item.unit_price)
      .map((item) => ({
        description: item.description.trim() || "Item",
        quantity: item.quantity > 0 ? item.quantity : 1,
        unit_price: round2(item.unit_price),
      })),
    tax: round2(Math.max(0, ai.tax)),
  };

  return {
    parsed: finalizeExtraction(data, { subtotal: ai.document_subtotal, total: ai.document_total }, ai.notes),
    transcript: ai.transcript,
    model: response.model,
  };
}
