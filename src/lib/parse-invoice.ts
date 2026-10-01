// Rule-based invoice parser: turns OCR or PDF text into structured fields.
// Heuristics cover common English invoice layouts; anything it can't find is reported in `missing`.

import { round2, type ExtractedInvoice, type ExtractedLineItem } from "@/lib/invoice";

export type ParsedField = "vendor" | "invoice_number" | "invoice_date" | "po_number" | "line_items" | "total";

export type ParseResult = {
  data: ExtractedInvoice;
  missing: ParsedField[];
  warnings: string[];
};

const CURRENCY = String.raw`(?:USD|EUR|GBP|PKR|AED|Rs\.?|[$€£₨])`;
const NUMBER = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?`;
const PERCENT_PREFIX = String.raw`(?:\s*\(?\s*\d+(?:\.\d+)?\s*%\s*\)?)?`;

// A number standing on its own (not glued into "INV-3337" or "5A-1204"), with optional currency and % suffix.
const NUMBER_TOKEN = new RegExp(
  String.raw`(?<![\w\-\/.])(${CURRENCY}\s?)?(${NUMBER})(?![\w\-\/])(\s*%)?`,
  "gi",
);

const ITEM_EXCLUDE = /\b(sub[\s-]?total|total|tax|vat|gst|balance|amount\s+due|due|paid|payment|discount|invoice|page)\b/i;

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

type NumberToken = { value: number; index: number; end: number; decimal: boolean; currency: boolean; percent: boolean };

function toAmount(raw: string) {
  return Number.parseFloat(raw.replace(/,/g, ""));
}

function numberTokens(line: string): NumberToken[] {
  return [...line.matchAll(NUMBER_TOKEN)].map((m) => ({
    value: toAmount(m[2]),
    index: m.index,
    end: m.index + m[0].length,
    decimal: m[2].includes("."),
    currency: Boolean(m[1]),
    percent: Boolean(m[3]),
  }));
}

// Last amount on a single line that follows the label, e.g. "Sub Total $85.00" or "VAT (20%) 50.00".
function labelledAmount(text: string, label: string) {
  const re = new RegExp(String.raw`${label}${PERCENT_PREFIX}[^\d\n]{0,20}?${CURRENCY}?\s?(${NUMBER})`, "gi");
  const matches = [...text.matchAll(re)];
  return matches.length ? toAmount(matches[matches.length - 1][1]) : null;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function isoDate(y: number, m: number, d: number) {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

function monthNumber(name: string) {
  return MONTHS[name.slice(0, 3).toLowerCase()];
}

export function parseDate(input: string): string | null {
  let m = input.match(/\b(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})\b/);
  if (m) return isoDate(+m[1], +m[2], +m[3]);

  m = input.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/);
  if (m && monthNumber(m[1])) return isoDate(+m[3], monthNumber(m[1]), +m[2]);

  m = input.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/);
  if (m && monthNumber(m[2])) return isoDate(+m[3], monthNumber(m[2]), +m[1]);

  m = input.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/);
  if (m) {
    const [a, b, y] = [+m[1], +m[2], +m[3]];
    // Ambiguous numeric dates are read day-first unless that's impossible.
    return b > 12 ? isoDate(y, a, b) : isoDate(y, b, a);
  }
  return null;
}

function findDate(lines: string[]) {
  const labels = [
    /\b(?:invoice|issue|issued|billing|bill)\s+date\b|\bdate\s+(?:of\s+)?issue\b/i,
    /^\s*date\b/i,
    /(?<!due\s)\bdate\b/i,
  ];
  for (const label of labels) {
    for (const line of lines) {
      const m = line.match(label);
      if (!m || m.index === undefined) continue;
      const date = parseDate(line.slice(m.index + m[0].length));
      if (date) return date;
    }
  }
  for (const line of lines) {
    if (/\bdue\b/i.test(line)) continue;
    const date = parseDate(line);
    if (date) return date;
  }
  return "";
}

function findReference(text: string, patterns: RegExp[]) {
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1] ?? m[0];
  }
  return "";
}

const REF_VALUE = String.raw`([A-Za-z0-9][\w\-\/]*\d[\w\-\/]*)`;

function findInvoiceNumber(text: string) {
  return findReference(text, [
    new RegExp(String.raw`\binvoice\s*(?:no\.?|number|num\.?|#|id)\s*[:#.]?\s*${REF_VALUE}`, "i"),
    /\bINV[-\s]?\d[\w-]*/i,
  ]);
}

function findPoNumber(text: string) {
  return findReference(text, [
    new RegExp(String.raw`\b(?:p\.?\s?o\.?|purchase\s+order)(?:\s*(?:no\.?|number|num\.?|#|ref))?\s*[:#]?\s*${REF_VALUE}`, "i"),
    new RegExp(String.raw`\border\s*(?:no\.?|number|num\.?|#|ref)\s*[:#]?\s*${REF_VALUE}`, "i"),
    /\bPO[-\s]?\d[\w-]*/i,
  ]);
}

function cleanVendor(line: string) {
  return line
    .replace(/[-–|:]*\s*\b(tax\s+)?invoice\b.*$/i, "")
    .replace(/\S+@\S+/g, "")
    .replace(/[\s\-–|,:]+$/, "")
    .trim();
}

function findVendor(lines: string[]) {
  const fromLabel = /^\s*(?:from|bill(?:ed)?\s+from|seller|supplier|vendor)\b\s*:?\s*/i;
  const fromIdx = lines.findIndex((l) => fromLabel.test(l));
  if (fromIdx >= 0) {
    const sameLine = cleanVendor(lines[fromIdx].replace(fromLabel, ""));
    if (sameLine) return sameLine;
    const next = lines.slice(fromIdx + 1).find((l) => cleanVendor(l));
    if (next) return cleanVendor(next);
  }

  const company = lines.find(
    (l) =>
      /\b(inc|llc|ltd|limited|corp|corporation|co\.|gmbh|pvt|plc|llp|company|enterprises|traders)\b/i.test(l) &&
      !/\b(bill|ship|sold)\s+to\b|^\s*to\b/i.test(l),
  );
  if (company && cleanVendor(company)) return cleanVendor(company);

  const first = lines.find((l) => /[A-Za-z]{3}/.test(l) && !/^\s*\d/.test(l) && !/^page\b/i.test(l) && cleanVendor(l));
  return first ? cleanVendor(first) : "";
}

function findCurrency(text: string) {
  const code = text.match(/\b(USD|EUR|GBP|PKR|AED)\b/);
  if (code) return code[1];
  if (text.includes("€")) return "EUR";
  if (text.includes("£")) return "GBP";
  if (/\bRs\.?\s?\d|₨/.test(text)) return "PKR";
  return "USD";
}

function cleanDescription(line: string) {
  return line
    .replace(NUMBER_TOKEN, " ")
    .replace(/\s[x×@]\s/gi, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s\-–:|.]+|[\s\-–:|]+$/g, "")
    .trim();
}

function sumItems(items: ExtractedLineItem[]) {
  return round2(items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0));
}

function findLineItems(lines: string[]): ExtractedLineItem[] {
  const items: ExtractedLineItem[] = [];
  // A row like "1.00 Web Design" whose amounts wrap onto the next line.
  let pending: { quantity: number; description: string } | null = null;

  for (const line of lines) {
    const carried = pending;
    pending = null;
    if (ITEM_EXCLUDE.test(line)) continue;

    const tokens = numberTokens(line).filter((t) => !t.percent);
    const last = tokens[tokens.length - 1];
    const endsWithAmount = last && (last.decimal || last.currency) && last.end >= line.trimEnd().length;

    if (tokens.length >= 2 && endsWithAmount) {
      const amount = last.value;
      const priceToken = tokens[tokens.length - 2];
      let unitPrice = priceToken.value;
      const timesQty = line.slice(0, priceToken.index).match(/(\d+(?:\.\d+)?)\s*[x×@]\s*$/i);

      let quantity: number;
      if (timesQty) quantity = Number.parseFloat(timesQty[1]);
      else if (tokens.length >= 3) quantity = tokens[tokens.length - 3].value;
      else if (carried) quantity = carried.quantity;
      else quantity = unitPrice > 0 && Number.isInteger(round2(amount / unitPrice)) ? round2(amount / unitPrice) : 1;
      if (quantity <= 0) quantity = 1;

      // The line amount is the source of truth (it already reflects discounts/adjustments).
      if (Math.abs(quantity * unitPrice - amount) > 0.01) unitPrice = round2(amount / quantity);

      const description = carried?.description || cleanDescription(line) || "Item";
      items.push({ description, quantity, unit_price: unitPrice });
      continue;
    }

    if (tokens.length === 1 && tokens[0].index === 0 && /[A-Za-z]{2}/.test(line)) {
      pending = { quantity: tokens[0].value, description: cleanDescription(line) };
    }
  }
  return items;
}

export function parseInvoiceText(text: string): ParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const vendor = findVendor(lines);
  const invoice_number = findInvoiceNumber(text);
  const invoice_date = findDate(lines);
  const po_number = findPoNumber(text);
  const currency = findCurrency(text);

  const docSubtotal = labelledAmount(text, String.raw`\bsub[\s-]?total\b`);
  const docTotal = labelledAmount(
    text,
    String.raw`(?<!sub[\s-]?)\b(?:grand\s+total|total(?:\s+(?:due|amount|payable))?|amount\s+due|balance\s+due)\b`,
  );
  let tax = labelledAmount(text, String.raw`\b(?:sales\s+tax|tax|vat|gst)\b`);

  let line_items = findLineItems(lines);
  const itemsFound = line_items.length > 0;
  const warnings: string[] = [];

  if (tax === null) {
    const base = docSubtotal ?? (itemsFound ? sumItems(line_items) : null);
    tax = docTotal !== null && base !== null ? Math.max(0, round2(docTotal - base)) : 0;
  }

  if (!itemsFound) {
    const fallback = docSubtotal ?? (docTotal !== null ? round2(docTotal - tax) : null);
    if (fallback !== null && fallback > 0) {
      line_items = [{ description: "Invoice amount (line items not detected)", quantity: 1, unit_price: fallback }];
      warnings.push("Line items weren't detected, so the subtotal was added as a single line. Split it if needed.");
    }
  }

  const itemsSum = sumItems(line_items);
  if (docSubtotal !== null && Math.abs(itemsSum - docSubtotal) > 0.01) {
    warnings.push(`Line items add up to ${itemsSum.toFixed(2)}, but the document's subtotal is ${docSubtotal.toFixed(2)}.`);
  }
  if (docTotal !== null && Math.abs(round2(itemsSum + tax) - docTotal) > 0.01) {
    warnings.push(`Calculated total is ${round2(itemsSum + tax).toFixed(2)}, but the document says ${docTotal.toFixed(2)}.`);
  }

  const data: ExtractedInvoice = { vendor, invoice_number, invoice_date, po_number, currency, line_items, tax };
  const missing: ParsedField[] = [];
  if (!vendor) missing.push("vendor");
  if (!invoice_number) missing.push("invoice_number");
  if (!invoice_date) missing.push("invoice_date");
  if (!po_number) missing.push("po_number");
  if (!itemsFound) missing.push("line_items");
  if (docTotal === null) missing.push("total");

  return { data, missing, warnings };
}

export function emptyParseResult(): ParseResult {
  return {
    data: { vendor: "", invoice_number: "", invoice_date: "", po_number: "", currency: "USD", line_items: [], tax: 0 },
    missing: ["vendor", "invoice_number", "invoice_date", "po_number", "line_items", "total"],
    warnings: [],
  };
}
