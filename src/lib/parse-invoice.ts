// Rule-based invoice parser: turns OCR or PDF text into structured fields.
// Heuristics cover common English invoice layouts; anything it can't find is reported in `missing`.

import { round2, type ExtractedInvoice, type ExtractedLineItem } from "@/lib/invoice";

export type ParsedField = "vendor" | "invoice_number" | "invoice_date" | "po_number" | "line_items" | "total";

export type ParseResult = {
  data: ExtractedInvoice;
  missing: ParsedField[];
  warnings: string[];
  // Subtotal/total as printed on the document, kept so merged OCR passes can re-run the cross-checks.
  printed: { subtotal: number | null; total: number | null };
  notes: string[];
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
  const name = line
    .split(/\s{3,}/)[0] // OCR keeps column gaps; anything after a wide gap belongs to another column
    .replace(/[-–|:]*\s*\b(tax\s+)?invoice\b.*$/i, "")
    .replace(/\S+@\S+/g, "")
    .replace(/^[^A-Za-z0-9]+|[\s\-–|,:]+$/g, "")
    .trim();
  // Reject OCR crumbs like "F" or "a I", and reference numbers like "INV-3337".
  if ((name.match(/[A-Za-z]/g)?.length ?? 0) < 3 || /^[A-Za-z]{1,5}[-\s#]?\d[\w-]*$/.test(name)) return "";
  // ...and field labels picked up from a neighbouring column, like "Order Number".
  if (/^(invoice|order|p\.?o\.?|purchase\s+order|due|issue|account|acc)\s*(number|no\.?|#|date)?$/i.test(name)) return "";
  return name;
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

      if (Math.abs(quantity * unitPrice - amount) > 0.01) {
        // OCR often drops decimal points ("1.00" -> "100"). If price and amount agree, the quantity is what broke.
        if (unitPrice > 0 && Number.isInteger(round2(amount / unitPrice))) quantity = round2(amount / unitPrice);
        // Otherwise the line amount is the source of truth (it already reflects discounts/adjustments).
        else unitPrice = round2(amount / quantity);
      }

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
  const notes: string[] = [];

  if (tax === null) {
    const base = docSubtotal ?? (itemsFound ? sumItems(line_items) : null);
    tax = docTotal !== null && base !== null ? Math.max(0, round2(docTotal - base)) : 0;
  }

  if (!itemsFound) {
    const fallback = docSubtotal ?? (docTotal !== null ? round2(docTotal - tax) : null);
    if (fallback !== null && fallback > 0) {
      line_items = [{ description: "Invoice amount (line items not detected)", quantity: 1, unit_price: fallback }];
      notes.push("Line items weren't detected, so the subtotal was added as a single line. Split it if needed.");
    }
  }

  const data: ExtractedInvoice = { vendor, invoice_number, invoice_date, po_number, currency, line_items, tax };
  const missing: ParsedField[] = [];
  if (!vendor) missing.push("vendor");
  if (!invoice_number) missing.push("invoice_number");
  if (!invoice_date) missing.push("invoice_date");
  if (!po_number) missing.push("po_number");
  if (!itemsFound) missing.push("line_items");
  if (docTotal === null) missing.push("total");

  const printed = { subtotal: docSubtotal, total: docTotal };
  const warnings = [...notes, ...totalChecks(data, nonNull([docSubtotal]), nonNull([docTotal]))];
  return { data, missing, warnings, printed, notes };
}

// Package fields extracted elsewhere (e.g. by a vision model) with the same missing-field
// report and total cross-checks the text parser produces.
export function finalizeExtraction(
  data: ExtractedInvoice,
  printed: { subtotal: number | null; total: number | null },
  notes: string[],
): ParseResult {
  const missing: ParsedField[] = [];
  if (!data.vendor) missing.push("vendor");
  if (!data.invoice_number) missing.push("invoice_number");
  if (!data.invoice_date) missing.push("invoice_date");
  if (!data.po_number) missing.push("po_number");
  if (data.line_items.length === 0) missing.push("line_items");
  if (printed.total === null) missing.push("total");
  const warnings = [...notes, ...totalChecks(data, nonNull([printed.subtotal]), nonNull([printed.total]))];
  return { data, missing, warnings, printed, notes };
}

function nonNull(values: (number | null)[]) {
  return values.filter((v): v is number => v !== null);
}

// Compare our calculated totals with the printed ones. With several OCR readings of the
// printed values, any one agreeing is enough (a single misread digit shouldn't raise an alarm).
function totalChecks(data: ExtractedInvoice, printedSubtotals: number[], printedTotals: number[]) {
  const warnings: string[] = [];
  const itemsSum = sumItems(data.line_items);
  const total = round2(itemsSum + data.tax);
  const agrees = (values: number[], target: number) => values.some((v) => Math.abs(v - target) <= 0.01);
  if (printedSubtotals.length && !agrees(printedSubtotals, itemsSum)) {
    warnings.push(`Line items add up to ${itemsSum.toFixed(2)}, but the document's subtotal is ${printedSubtotals[0].toFixed(2)}.`);
  }
  if (printedTotals.length && !agrees(printedTotals, total)) {
    warnings.push(`Calculated total is ${total.toFixed(2)}, but the document says ${printedTotals[0].toFixed(2)}.`);
  }
  return warnings;
}

const HEADER_FIELDS = ["vendor", "invoice_number", "invoice_date", "po_number"] as const;
const FIELD_ORDER: ParsedField[] = ["vendor", "invoice_number", "invoice_date", "po_number", "line_items", "total"];

function vote(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  let winner = "";
  let top = 0;
  for (const [value, count] of counts) {
    // Ties go to the earliest pass, so callers order passes by header-field reliability.
    if (count > top) [winner, top] = [value, count];
  }
  return winner;
}

// Combine parses of one document from several OCR passes: vote on header fields, and take
// line items and tax from the pass whose numbers are most self-consistent.
export function mergeParseResults(results: ParseResult[]): ParseResult {
  if (results.length === 1) return results[0];
  const badness = (r: ParseResult) =>
    (r.missing.includes("line_items") ? 10 : 0) + (r.missing.includes("total") ? 1 : 0) + r.warnings.length;
  const best = results.reduce((a, b) => (badness(b) < badness(a) ? b : a));

  const data = { ...best.data, currency: vote(results.map((r) => r.data.currency)) || "USD" };
  for (const field of HEADER_FIELDS) data[field] = vote(results.map((r) => r.data[field]));

  const missing = FIELD_ORDER.filter((field) => {
    if (field === "total") return results.every((r) => r.missing.includes("total"));
    if (field === "line_items") return best.missing.includes(field);
    return !data[field];
  });

  const subtotals = nonNull([best.printed.subtotal, ...results.map((r) => r.printed.subtotal)]);
  const totals = nonNull([best.printed.total, ...results.map((r) => r.printed.total)]);
  const warnings = [...best.notes, ...totalChecks(data, subtotals, totals)];
  return { data, missing, warnings, printed: best.printed, notes: best.notes };
}

export function emptyParseResult(): ParseResult {
  return {
    data: { vendor: "", invoice_number: "", invoice_date: "", po_number: "", currency: "USD", line_items: [], tax: 0 },
    missing: ["vendor", "invoice_number", "invoice_date", "po_number", "line_items", "total"],
    warnings: [],
    printed: { subtotal: null, total: null },
    notes: [],
  };
}
