"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { CloudUpload, Download, FileText, Loader2, RotateCcw } from "lucide-react";
import { loadCpiConfig } from "@/lib/cpi-config";
import { PayloadPreview } from "@/components/scan/payload-preview";
import { ProcessingSteps } from "@/components/scan/processing-steps";
import { ReviewForm } from "@/components/scan/review-form";
import { Toast, type ToastData } from "@/components/scan/toast";
import { UploadZone } from "@/components/scan/upload-zone";
import {
  SAP_INBOUND_DIR,
  buildPayload,
  localIsoTimestamp,
  payloadFileName,
  serializePayload,
  toDraft,
  validateDraft,
  type InvoiceDraft,
  type OcrResult,
  type PayloadFormat,
  type ScanResponse,
} from "@/lib/invoice";
import { cn } from "@/lib/utils";

type Stage = "upload" | "processing" | "review";

const STAGES: { id: Stage; label: string }[] = [
  { id: "upload", label: "Upload" },
  { id: "processing", label: "Process" },
  { id: "review", label: "Review & sync" },
];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Trigger a browser download of generated text content.
function saveFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const CHIP = "rounded-pill px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.02em]";

const FIELD_LABELS: Record<string, string> = {
  vendor: "vendor name",
  invoice_number: "invoice number",
  invoice_date: "invoice date",
  po_number: "PO number",
  line_items: "line items",
  total: "document total",
};

type ParseNotes = { missing: string[]; warnings: string[] };

function OcrBadge({ ocr }: { ocr: OcrResult }) {
  if (ocr.status === "ok") {
    return (
      <span className={cn(CHIP, "bg-pale-green text-deep-green")}>
        {ocr.method === "ocr" ? `OCR · ${ocr.confidence}% confidence` : "PDF text layer"}
      </span>
    );
  }
  return (
    <span title={ocr.reason} className={cn(CHIP, "bg-[#fff4f1] text-[#b4401f]")}>
      OCR {ocr.status}
    </span>
  );
}

export default function ScanPage() {
  const [stage, setStage] = useState<Stage>("upload");
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<InvoiceDraft | null>(null);
  const [ocr, setOcr] = useState<OcrResult | null>(null);
  const [notes, setNotes] = useState<ParseNotes>({ missing: [], warnings: [] });
  const [generatedAt, setGeneratedAt] = useState("");
  const [format, setFormat] = useState<PayloadFormat>("json");
  const [syncing, setSyncing] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);

  // Each scan gets an id so a stale response can't overwrite a newer scan or a reset.
  const runId = useRef(0);
  const previewRef = useRef<string | null>(null);

  const payload = useMemo(() => (draft ? buildPayload(draft, generatedAt) : null), [draft, generatedAt]);
  const validationError = draft ? validateDraft(draft) : null;

  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  function replacePreview(next: File | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = next?.type.startsWith("image/") ? URL.createObjectURL(next) : null;
    setPreviewUrl(previewRef.current);
  }

  async function handleFile(next: File) {
    const id = ++runId.current;
    const isCurrent = () => id === runId.current;

    setError(null);
    setFile(next);
    replacePreview(next);
    setStep(0);
    setStage("processing");

    try {
      const body = new FormData();
      body.append("file", next);
      const uploadBeat = wait(700).then(() => isCurrent() && setStep(1));
      const res = await fetch("/api/scan-invoice", { method: "POST", body });
      await uploadBeat;
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) {
        throw new Error(json?.error ?? `The scan service failed (HTTP ${res.status}). Try again.`);
      }
      if (!isCurrent()) return;

      setStep(2);
      await wait(900);
      if (!isCurrent()) return;

      const result = json as ScanResponse;
      setDraft(toDraft(result.data));
      setOcr(result.ocr);
      setNotes({ missing: result.missing, warnings: result.warnings });
      setGeneratedAt(localIsoTimestamp());
      setStage("review");
    } catch (err) {
      if (!isCurrent()) return;
      setError(err instanceof Error ? err.message : "Scan failed. Try again.");
      setStage("upload");
    }
  }

  function reset() {
    runId.current += 1;
    replacePreview(null);
    setFile(null);
    setDraft(null);
    setOcr(null);
    setError(null);
    setStage("upload");
  }

  async function handleSync() {
    if (!draft || validationError) return;
    setSyncing(true);
    try {
      // Stamp the file at save time, so the name reflects when it was produced.
      const stamp = localIsoTimestamp();
      const finalPayload = buildPayload(draft, stamp);
      setGeneratedAt(stamp);

      const res = await fetch("/api/sync-to-sap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, payload: finalPayload }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.message ?? "The payload didn't pass validation.");

      const fileName = payloadFileName(finalPayload, format);
      saveFile(fileName, serializePayload(finalPayload, format), format === "json" ? "application/json" : "application/xml");
      setToast({
        kind: "success",
        title: `✅ Saved ${fileName} to your device.`,
        detail: `Copy it into the AL11 inbound directory (${SAP_INBOUND_DIR}).`,
      });
    } catch (err) {
      setToast({ kind: "error", title: "Couldn't save the file", detail: err instanceof Error ? err.message : undefined });
    } finally {
      setSyncing(false);
    }
  }

  // POST the invoice JSON to the SAP CPI iFlow configured under Settings → SAP CPI.
  async function handlePushToCpi() {
    if (!draft || validationError) return;
    const config = loadCpiConfig();
    if (!config) {
      setToast({
        kind: "error",
        title: "SAP CPI isn't set up yet",
        detail: "Add the iFlow endpoint, username and password under Settings → SAP CPI.",
      });
      return;
    }

    setPushing(true);
    try {
      const stamp = localIsoTimestamp();
      const finalPayload = buildPayload(draft, stamp);
      setGeneratedAt(stamp);

      const res = await fetch("/api/push-to-cpi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "push",
          endpoint: config.endpoint,
          username: config.username,
          password: config.password,
          csrf: config.csrf,
          format: "json",
          fileName: payloadFileName(finalPayload, "json"),
          content: serializePayload(finalPayload, "json"),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!json?.ok) throw new Error(json?.message ?? `The push failed (HTTP ${res.status}).`);
      setToast({
        kind: "success",
        title: `✅ Pushed ${finalPayload.header.invoice_number || "invoice"} to SAP CPI (HTTP ${json.status}).`,
        detail: json.messageId ? `Message ID ${json.messageId}` : json.message,
      });
    } catch (err) {
      setToast({ kind: "error", title: "Couldn't push to SAP CPI", detail: err instanceof Error ? err.message : undefined });
    } finally {
      setPushing(false);
    }
  }

  const stageIndex = STAGES.findIndex((s) => s.id === stage);

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-10">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.02em] text-slate">Core workflow</p>
            <h1 className="mt-3 font-display text-5xl leading-none tracking-[-0.03em] text-black sm:text-6xl">
              Scan & Sync
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-snug text-body-muted">
              Turn a paper invoice or PO into a structured file in the SAP inbound folder.
            </p>
          </div>
          <ol className="flex flex-wrap gap-2" aria-label="Progress">
            {STAGES.map((s, i) => (
              <li
                key={s.id}
                aria-current={i === stageIndex ? "step" : undefined}
                className={cn(
                  "rounded-pill border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.02em]",
                  i === stageIndex && "border-primary bg-primary text-white",
                  i < stageIndex && "border-hairline text-body-muted",
                  i > stageIndex && "border-hairline text-muted",
                )}
              >
                0{i + 1} {s.label}
              </li>
            ))}
          </ol>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={stage}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {stage === "upload" && <UploadZone error={error} onFile={handleFile} onError={setError} />}

            {stage === "processing" && file && (
              <ProcessingSteps fileName={file.name} previewUrl={previewUrl} step={step} />
            )}

            {stage === "review" && draft && payload && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-hairline py-4 text-sm">
                  <span className="inline-flex min-w-0 items-center gap-2 text-ink">
                    <FileText className="size-4 shrink-0 text-slate" strokeWidth={1.75} />
                    <span className="truncate">{file?.name}</span>
                  </span>
                  {ocr && <OcrBadge ocr={ocr} />}
                  <span className={cn(CHIP, "border border-hairline text-body-muted")}>Parser · rules</span>
                  {ocr && ocr.status !== "ok" && <span className="text-xs text-slate">{ocr.reason}</span>}
                </div>

                {(notes.missing.length > 0 || notes.warnings.length > 0) && (
                  <div role="status" className="rounded-chip border border-coral-soft bg-[#fff4f1] px-5 py-4 text-sm text-ink">
                    <p className="font-medium text-black">Check these before syncing</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-body-muted">
                      {notes.missing.length > 0 && (
                        <li>Not found in the document: {notes.missing.map((key) => FIELD_LABELS[key] ?? key).join(", ")}.</li>
                      )}
                      {notes.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {ocr?.status === "ok" && (
                  <details className="rounded-chip bg-stone">
                    <summary className="cursor-pointer px-5 py-3 font-mono text-xs uppercase tracking-[0.02em] text-body-muted hover:text-black">
                      {ocr.method === "ocr" ? "Raw OCR text" : "Extracted PDF text"}
                    </summary>
                    <pre className="max-h-60 overflow-auto whitespace-pre-wrap border-t border-hairline px-5 py-4 font-mono text-xs leading-relaxed text-ink">
                      {ocr.text.trim() || "(no text detected)"}
                    </pre>
                  </details>
                )}

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
                  <ReviewForm draft={draft} onChange={setDraft} />
                  <div className="lg:sticky lg:top-24">
                    <PayloadPreview payload={payload} format={format} onFormatChange={setFormat} />
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-hairline pt-8 sm:flex-row sm:items-center sm:justify-end">
                  {validationError && (
                    <p role="alert" className="text-sm text-error sm:mr-auto">
                      {validationError}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={reset}
                    className="inline-flex items-center justify-center gap-2 rounded-pill border border-primary bg-transparent px-6 py-3 text-sm font-medium text-primary transition-colors hover:bg-stone"
                  >
                    <RotateCcw className="size-4" strokeWidth={1.75} />
                    Re-scan / Adjust
                  </button>
                  <button
                    type="button"
                    onClick={handleSync}
                    disabled={syncing || Boolean(validationError)}
                    className="inline-flex items-center justify-center gap-2 rounded-pill border border-primary bg-transparent px-6 py-3 text-sm font-medium text-primary transition-colors hover:bg-stone disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {syncing ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" strokeWidth={1.75} />}
                    {syncing ? "Saving…" : "Save File for SAP AL11"}
                  </button>
                  <button
                    type="button"
                    onClick={handlePushToCpi}
                    disabled={pushing || Boolean(validationError)}
                    className="inline-flex items-center justify-center gap-2 rounded-pill bg-primary px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {pushing ? <Loader2 className="size-4 animate-spin" /> : <CloudUpload className="size-4" strokeWidth={1.75} />}
                    {pushing ? "Pushing…" : "Push to SAP CPI"}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </MotionConfig>
  );
}
