// Shared invoice model: what the scan API returns, what the review form edits,
// and the payload that gets written to the SAP shared folder.

export type ExtractedLineItem = {
  description: string;
  quantity: number;
  unit_price: number;
};

export type ExtractedInvoice = {
  vendor: string;
  invoice_number: string;
  invoice_date: string; // YYYY-MM-DD
  po_number: string;
  currency: string;
  line_items: ExtractedLineItem[];
  tax: number;
};

// How the document's text was obtained: OCR for images, the embedded text layer for PDFs.
export type OcrResult =
  | { status: "ok"; method: "ocr"; confidence: number; text: string }
  | { status: "ok"; method: "pdf"; text: string }
  | { status: "skipped" | "failed"; reason: string };

export type ScanResponse = {
  data: ExtractedInvoice;
  ocr: OcrResult;
  parser: "rules";
  // Field keys the parser couldn't find, and cross-checks that didn't add up.
  missing: string[];
  warnings: string[];
};

// Form state keeps numbers as strings so half-typed values like "12." survive.
export type DraftLineItem = {
  id: string;
  description: string;
  quantity: string;
  unit_price: string;
};

export type InvoiceDraft = Omit<ExtractedInvoice, "line_items" | "tax"> & {
  line_items: DraftLineItem[];
  tax: string;
};

export type PayloadFormat = "json" | "xml";

export type SapPayload = {
  document_type: "SUPPLIER_INVOICE";
  header: {
    vendor_name: string;
    invoice_number: string;
    invoice_date: string;
    po_number: string;
    currency: string;
  };
  items: { line: number; description: string; quantity: number; unit_price: number; amount: number }[];
  totals: { subtotal: number; tax: number; total: number };
  meta: { source: "invoq"; target_dir: "/sap/inbound/"; generated_at: string };
};

export const CURRENCIES = ["USD", "EUR", "GBP", "PKR", "AED"] as const;

export const SAP_INBOUND_DIR = "/sap/inbound/";

let lineSeq = 0;
export function newLineId() {
  lineSeq += 1;
  return `line-${lineSeq}`;
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function toNumber(value: string) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export function toDraft(data: ExtractedInvoice): InvoiceDraft {
  return {
    ...data,
    tax: data.tax.toFixed(2),
    line_items: data.line_items.map((item) => ({
      id: newLineId(),
      description: item.description,
      quantity: String(item.quantity),
      unit_price: item.unit_price.toFixed(2),
    })),
  };
}

export function draftTotals(draft: InvoiceDraft) {
  const subtotal = round2(
    draft.line_items.reduce((sum, item) => sum + toNumber(item.quantity) * toNumber(item.unit_price), 0),
  );
  const tax = round2(toNumber(draft.tax));
  return { subtotal, tax, total: round2(subtotal + tax) };
}

export function buildPayload(draft: InvoiceDraft, generatedAt: string): SapPayload {
  return {
    document_type: "SUPPLIER_INVOICE",
    header: {
      vendor_name: draft.vendor.trim(),
      invoice_number: draft.invoice_number.trim(),
      invoice_date: draft.invoice_date,
      po_number: draft.po_number.trim(),
      currency: draft.currency,
    },
    items: draft.line_items.map((item, i) => {
      const quantity = toNumber(item.quantity);
      const unit_price = round2(toNumber(item.unit_price));
      return {
        line: (i + 1) * 10, // SAP item numbering convention: 10, 20, 30...
        description: item.description.trim(),
        quantity,
        unit_price,
        amount: round2(quantity * unit_price),
      };
    }),
    totals: draftTotals(draft),
    meta: { source: "invoq", target_dir: SAP_INBOUND_DIR, generated_at: generatedAt },
  };
}

function escapeXml(value: string | number) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xmlBlock(tag: string, fields: Record<string, string | number>, indent: string) {
  const inner = Object.entries(fields)
    .map(([key, value]) => `${indent}  <${key}>${escapeXml(value)}</${key}>`)
    .join("\n");
  return `${indent}<${tag}>\n${inner}\n${indent}</${tag}>`;
}

export function payloadToXml(payload: SapPayload) {
  const items = payload.items.map((item) => xmlBlock("Item", item, "    ")).join("\n");
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<SupplierInvoice type="${payload.document_type}">`,
    xmlBlock("Header", payload.header, "  "),
    `  <Items>`,
    items,
    `  </Items>`,
    xmlBlock("Totals", payload.totals, "  "),
    xmlBlock("Meta", payload.meta, "  "),
    `</SupplierInvoice>`,
  ].join("\n");
}

export function serializePayload(payload: SapPayload, format: PayloadFormat) {
  return format === "json" ? JSON.stringify(payload, null, 2) : payloadToXml(payload);
}

// ISO 8601 with the device's UTC offset (e.g. 2026-10-02T09:15:12+05:00), so the
// timestamp in the file name matches the user's wall clock.
export function localIsoTimestamp(date = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  return (
    `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}` +
    `T${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}` +
    `${sign}${p(Math.floor(Math.abs(offset) / 60))}:${p(Math.abs(offset) % 60)}`
  );
}

// "<invoice number>_<YYYYMMDD-HHmmss>.<ext>", e.g. INV-3337_20261002-091512.json.
export function payloadFileName(payload: SapPayload, format: PayloadFormat) {
  const ref =
    (payload.header.invoice_number || payload.header.po_number || "INVOICE").replace(/[^A-Za-z0-9-]/g, "") || "INVOICE";
  // Read the date/time digits straight from the string so the name keeps the local time it was stamped with.
  const stamp = payload.meta.generated_at.slice(0, 19).replace(/-/g, "").replace("T", "-").replace(/:/g, "");
  return `${ref}_${stamp}.${format}`;
}

export function validateDraft(draft: InvoiceDraft): string | null {
  if (!draft.vendor.trim()) return "Vendor name is required.";
  if (!draft.invoice_date) return "Invoice date is required.";
  if (draft.line_items.length === 0) return "Add at least one line item.";
  if (draft.line_items.some((item) => !item.description.trim())) return "Every line item needs a description.";
  if (draft.line_items.some((item) => toNumber(item.quantity) <= 0)) return "Line item quantities must be above zero.";
  return null;
}
