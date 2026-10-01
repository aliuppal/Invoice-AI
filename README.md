# Invoq

Scan a paper invoice or purchase order, extract its text with OCR, review the structured data, and sync it to an SAP inbound folder (read through transaction AL11).

This is an MVP. Text extraction is real: Tesseract.js OCR for images, the embedded text layer for PDFs. A rule-based parser (`src/lib/parse-invoice.ts`) turns that text into fields and flags anything it can't find or that doesn't add up. The SAP write is simulated.

## Stack

Next.js 16 (App Router, TypeScript) · Tailwind CSS v4 · Framer Motion · Lucide · react-dropzone · tesseract.js

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. The first scan downloads Tesseract's English language data (~10 MB), so it needs internet access and takes a few extra seconds.

## Routes

| Route | What it does |
| --- | --- |
| `/dashboard` | Revenue, outstanding and SAP sync figures, recent invoices (mock data) |
| `/dashboard/scan` | Upload or photograph a document → OCR → editable review with live JSON/XML payload → sync |
| `/dashboard/invoices` | All invoices (mock data) |
| `/dashboard/settings` | SAP and OCR configuration (read-only) |
| `POST /api/scan-invoice` | `multipart/form-data` with `file`. OCRs images or reads the PDF text layer, parses it, returns structured data plus missing fields and warnings |
| `POST /api/sync-to-sap` | JSON `{ format: "json" \| "xml", payload }`. Validates and simulates writing to `/sap/inbound/` |

## Next steps

- Swap or back up the rule-based parser with an LLM for unusual invoice layouts.
- Rasterise scanned PDF pages so they can be OCR'd.
- Write the payload to the real S3/SFTP share that SAP reads.
