"use client";

import { AnimatePresence, motion } from "framer-motion";
import { TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastData = { kind: "success" | "error"; title: string; detail?: string };

type Props = {
  toast: ToastData | null;
  onDismiss: () => void;
};

export function Toast({ toast, onDismiss }: Props) {
  return (
    <div
      aria-live="polite"
      role="status"
      className="pointer-events-none fixed inset-x-4 bottom-20 z-50 flex justify-end sm:inset-x-auto sm:right-6 sm:bottom-6"
    >
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.title + toast.detail}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={cn(
              "pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-block px-5 py-4 text-white",
              toast.kind === "success" ? "bg-deep-green" : "bg-error",
            )}
          >
            {toast.kind === "error" && <TriangleAlert className="mt-0.5 size-4 shrink-0" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{toast.title}</p>
              {toast.detail && <p className="mt-1 break-all font-mono text-xs text-white/70">{toast.detail}</p>}
            </div>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss notification"
              className="grid size-6 shrink-0 place-items-center rounded-full text-white/70 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
