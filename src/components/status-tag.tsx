import type { InvoiceStatus } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const STYLES: Record<InvoiceStatus, string> = {
  paid: "bg-pale-green text-deep-green",
  pending: "bg-pale-blue text-action-blue",
  overdue: "bg-[#fff0ec] text-error",
};

export function StatusTag({ status }: { status: InvoiceStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.02em]",
        STYLES[status],
      )}
    >
      {status}
    </span>
  );
}
