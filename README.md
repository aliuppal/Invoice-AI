# Invoq

Scan a paper invoice or purchase order, extract its text with OCR, review the structured data, and sync it to an SAP inbound folder (read through transaction AL11).

This is an MVP: OCR is real (Tesseract.js, server-side), but field structuring and the SAP write are mocked.

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
| `POST /api/scan-invoice` | `multipart/form-data` with `file`. Runs OCR on images (PDFs skip OCR), returns mock structured data plus the OCR result |
| `POST /api/sync-to-sap` | JSON `{ format: "json" \| "xml", payload }`. Validates and simulates writing to `/sap/inbound/` |

## Next steps

- Replace `MOCK_EXTRACTION` in `src/app/api/scan-invoice/route.ts` with regex or LLM parsing of the OCR text.
- Rasterise PDF pages so they can be OCR'd.
- Write the payload to the real S3/SFTP share that SAP reads.
