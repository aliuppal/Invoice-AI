"use client";

import { motion } from "framer-motion";
import { Check, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const PROCESSING_STEPS = [
  "Uploading document...",
  "Running Tesseract OCR...",
  "Structuring data for SAP AL11...",
] as const;

type Props = {
  fileName: string;
  previewUrl: string | null;
  step: number;
};

export function ProcessingSteps({ fileName, previewUrl, step }: Props) {
  return (
    <div className="grid gap-8 rounded-media bg-deep-green p-6 text-white sm:p-10 md:grid-cols-[16rem_1fr] md:gap-12">
      <div className="relative aspect-[3/4] overflow-hidden rounded-block bg-white">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- local blob URL, nothing to optimise
          <img src={previewUrl} alt={`Preview of ${fileName}`} className="size-full object-contain" />
        ) : (
          <div className="grid size-full place-items-center text-slate">
            <FileText className="size-12" strokeWidth={1.25} />
          </div>
        )}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          initial={{ y: "-100%" }}
          animate={{ y: "100%" }}
          transition={{ duration: 1.8, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" }}
        >
          <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-b from-transparent to-coral/25" />
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-coral" />
        </motion.div>
      </div>

      <div className="flex flex-col justify-center">
        <p className="font-mono text-xs uppercase tracking-[0.02em] text-white/60">Processing</p>
        <p className="mt-3 truncate font-display text-3xl tracking-[-0.02em] sm:text-4xl" title={fileName}>
          {fileName}
        </p>

        <div className="mt-8 h-1 w-full overflow-hidden rounded-full bg-white/15" aria-hidden>
          <motion.div
            className="h-full rounded-full bg-coral"
            initial={{ width: "0%" }}
            animate={{ width: `${((step + 1) / PROCESSING_STEPS.length) * 100}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>

        <ol className="mt-8 space-y-4">
          {PROCESSING_STEPS.map((label, i) => {
            const state = i < step ? "done" : i === step ? "active" : "pending";
            return (
              <motion.li
                key={label}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08, duration: 0.25 }}
                className="flex items-center gap-3"
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full border",
                    state === "done" && "border-white bg-white text-deep-green",
                    state === "active" && "border-coral text-coral",
                    state === "pending" && "border-white/25",
                  )}
                >
                  {state === "done" && <Check className="size-3.5" strokeWidth={2.5} />}
                  {state === "active" && <Loader2 className="size-3.5 motion-safe:animate-spin" />}
                </span>
                <span
                  className={cn(
                    "font-mono text-sm",
                    state === "done" && "text-white/70",
                    state === "active" && "text-white",
                    state === "pending" && "text-white/40",
                  )}
                >
                  {label}
                </span>
              </motion.li>
            );
          })}
        </ol>

        <p className="sr-only" aria-live="polite">
          {PROCESSING_STEPS[step]}
        </p>
      </div>
    </div>
  );
}
