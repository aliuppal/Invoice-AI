"use client";

import { AlertTriangle, CheckCircle2, Clock, Loader2, RotateCw, Search, X } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import {
  AGING_BUCKETS,
  agingBucket,
  isOverdue,
  type AgingBucketId,
  type PaymentStatus,
  type SapInvoice,
} from "@/lib/sap-invoices";
import { cn, formatDate, formatMoney } from "@/lib/utils";

export type QuickFilter = "all" | "overdue" | "failed";

export type InvoiceFilters = {
  query: string;
  from: string; // YYYY-MM-DD or ""
  to: string;
  quick: QuickFilter;
  bucket: AgingBucketId | null;
};

export const EMPTY_FILTERS: InvoiceFilters = { query: "", from: "", to: "", quick: "all", bucket: null };

export function applyFilters(invoices: SapInvoice[], f: InvoiceFilters) {
  const q = f.query.trim().toLowerCase();
  return invoices
    .filter((inv) => {
      if (q && ![inv.InvoiceID, inv.Vendor, inv.SAPDocumentNumber].some((v) => v.toLowerCase().includes(q))) return false;
      // ISO dates compare correctly as strings.
      if (f.from && inv.Date < f.from) return false;
      if (f.to && inv.Date > f.to) return false;
      if (f.quick === "overdue" && !isOverdue(inv)) return false;
      if (f.quick === "failed" && inv.SAPSyncStatus !== "Failed") return false;
      if (f.bucket && agingBucket(inv) !== f.bucket) return false;
      return true;
    })
    .sort((a, b) => b.Date.localeCompare(a.Date));
}

const PAYMENT_STYLES: Record<PaymentStatus, string> = {
  Paid: "bg-pale-green text-deep-green",
  Open: "bg-pale-blue text-action-blue",
  Overdue: "bg-[#fff0ec] text-error",
};

const INPUT =
  "rounded-[4px] border border-hairline bg-white px-3 py-2 text-sm text-black placeholder:text-muted focus:border-form-focus focus:outline-none focus:ring-1 focus:ring-form-focus";

function SyncCell({ invoice, retrying, onRetry }: { invoice: SapInvoice; retrying: boolean; onRetry: () => void }) {
  if (invoice.SAPSyncStatus === "Synced") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-deep-green">
        <CheckCircle2 className="size-3.5" aria-hidden /> Synced
      </span>
    );
  }
  if (invoice.SAPSyncStatus === "Pending") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate">
        <Clock className="size-3.5" aria-hidden /> Pending
      </span>
    );
  }
  const error = invoice.SyncError;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Tooltip
        align="end"
        content={
          <>
            <span className="block font-mono text-[11px] text-coral-soft">SAP message {error?.code}</span>
            {error?.message}
            {error && !error.retryable && (
              <span className="mt-1 block text-white/70">Fix this in SAP first; retrying alone won&apos;t clear it.</span>
            )}
          </>
        }
        triggerClassName="bg-error px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.02em] text-white"
      >
        <AlertTriangle className="size-3" aria-hidden /> Sync failed
      </Tooltip>
      {error && !error.retryable ? (
        <span className="rounded-pill bg-coral px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.02em] text-primary">
          Fix in SAP
        </span>
      ) : (
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="inline-flex items-center gap-1 rounded-pill border border-primary px-2.5 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-stone disabled:opacity-50"
      >
        {retrying ? <Loader2 className="size-3 animate-spin" aria-hidden /> : <RotateCw className="size-3" aria-hidden />}
        {retrying ? "Retrying" : "Retry"}
        <span className="sr-only"> sync for {invoice.InvoiceID}</span>
      </button>
      )}
    </span>
  );
}

type Props = {
  invoices: SapInvoice[];
  filters: InvoiceFilters;
  onFiltersChange: (filters: InvoiceFilters) => void;
  retrying: ReadonlySet<string>;
  onRetry: (invoiceId: string) => void;
};

export function InvoiceTable({ invoices, filters, onFiltersChange, retrying, onRetry }: Props) {
  const rows = applyFilters(invoices, filters);
  const set = (patch: Partial<InvoiceFilters>) => onFiltersChange({ ...filters, ...patch });
  const overdueCount = invoices.filter(isOverdue).length;
  const failedCount = invoices.filter((i) => i.SAPSyncStatus === "Failed").length;
  const filtered =
    filters.query || filters.from || filters.to || filters.quick !== "all" || filters.bucket !== null;
  const bucketLabel = AGING_BUCKETS.find((b) => b.id === filters.bucket)?.label;

  const QUICK: { id: QuickFilter; label: string; count?: number }[] = [
    { id: "all", label: "All" },
    { id: "overdue", label: "Overdue", count: overdueCount },
    { id: "failed", label: "Sync failed", count: failedCount },
  ];

  return (
    <div>
      {/* Filters: one row above the table. */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="relative flex-1">
          <label htmlFor="invoice-search" className="sr-only">
            Search invoices
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate" aria-hidden />
          <input
            id="invoice-search"
            type="search"
            placeholder="Search invoice # or vendor"
            className={cn(INPUT, "w-full pl-9")}
            value={filters.query}
            onChange={(e) => set({ query: e.target.value })}
          />
        </div>
        <fieldset className="flex items-end gap-2">
          <legend className="sr-only">Invoice date range</legend>
          <label className="text-xs text-body-muted">
            From
            <input
              type="date"
              className={cn(INPUT, "mt-1 block")}
              value={filters.from}
              max={filters.to || undefined}
              onChange={(e) => set({ from: e.target.value })}
            />
          </label>
          <label className="text-xs text-body-muted">
            To
            <input
              type="date"
              className={cn(INPUT, "mt-1 block")}
              value={filters.to}
              min={filters.from || undefined}
              onChange={(e) => set({ to: e.target.value })}
            />
          </label>
        </fieldset>
        <div role="group" aria-label="Quick filters" className="flex rounded-pill border border-hairline p-0.5">
          {QUICK.map((q) => (
            <button
              key={q.id}
              type="button"
              aria-pressed={filters.quick === q.id}
              onClick={() => set({ quick: q.id })}
              className={cn(
                "rounded-pill px-3 py-1.5 text-sm transition-colors",
                filters.quick === q.id ? "bg-primary text-white" : "text-ink hover:bg-stone",
              )}
            >
              {q.label}
              {q.count !== undefined && <span className="ml-1 font-mono text-xs opacity-70">{q.count}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex min-h-8 flex-wrap items-center gap-2 text-sm text-body-muted" aria-live="polite">
        <span>
          Showing <span className="text-ink">{rows.length}</span> of {invoices.length}
        </span>
        {bucketLabel && (
          <button
            type="button"
            onClick={() => set({ bucket: null })}
            className="inline-flex items-center gap-1 rounded-pill bg-stone px-2.5 py-0.5 text-xs text-ink hover:bg-hairline"
          >
            Aging: {bucketLabel} <X className="size-3" aria-label="Remove aging filter" />
          </button>
        )}
        {filtered && (
          <button
            type="button"
            onClick={() => onFiltersChange(EMPTY_FILTERS)}
            className="text-sm text-ink underline underline-offset-4 hover:text-action-blue"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* relative: absolutely positioned descendants (sr-only labels, tooltips) must be clipped by
          this scroller, not escape it and widen the page on small screens. */}
      <div className="relative mt-2 overflow-x-auto">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="border-b border-hairline font-mono text-[11px] uppercase tracking-[0.02em] text-slate">
            <tr>
              <th scope="col" className="py-3 pl-3 pr-4 font-normal">Invoice</th>
              <th scope="col" className="px-4 py-3 font-normal">Vendor</th>
              <th scope="col" className="px-4 py-3 font-normal">Date</th>
              <th scope="col" className="px-4 py-3 text-right font-normal">Amount</th>
              <th scope="col" className="px-4 py-3 font-normal">Status</th>
              <th scope="col" className="px-4 py-3 font-normal">Aging</th>
              <th scope="col" className="py-3 pl-4 font-normal">SAP sync</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.map((inv) => {
              const bucket = AGING_BUCKETS.find((b) => b.id === agingBucket(inv));
              const highlight = filters.quick === "overdue" && isOverdue(inv);
              return (
                <tr key={inv.InvoiceID} className={cn("transition-colors", highlight && "bg-[#fff4f1]")}>
                  <td className={cn("py-4 pl-3 pr-4", highlight && "shadow-[inset_3px_0_0_#a63c1a]")}>
                    <span className="block text-black">{inv.InvoiceID}</span>
                    <span className="font-mono text-[11px] text-slate">SAP {inv.SAPDocumentNumber}</span>
                  </td>
                  <td className="px-4 py-4 text-ink">{inv.Vendor}</td>
                  <td className="px-4 py-4 text-body-muted">{formatDate(inv.Date)}</td>
                  <td className="px-4 py-4 text-right font-mono tabular-nums">{formatMoney(inv.Amount, inv.Currency)}</td>
                  <td className="px-4 py-4">
                    <span
                      className={cn(
                        "inline-flex rounded-pill px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.02em]",
                        PAYMENT_STYLES[inv.Status],
                      )}
                    >
                      {inv.Status}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    {bucket ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-ink">
                        <span aria-hidden className="size-2 rounded-[2px]" style={{ backgroundColor: bucket.color }} />
                        {inv.AgingDays > 0 ? `${inv.AgingDays} ${inv.AgingDays === 1 ? "day" : "days"}` : "Current"}
                      </span>
                    ) : (
                      <span className="text-xs text-slate">—</span>
                    )}
                  </td>
                  <td className="py-4 pl-4">
                    <SyncCell invoice={inv} retrying={retrying.has(inv.InvoiceID)} onRetry={() => onRetry(inv.InvoiceID)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="border-b border-hairline py-12 text-center">
            <p className="text-body-muted">No invoices match these filters.</p>
            <button
              type="button"
              onClick={() => onFiltersChange(EMPTY_FILTERS)}
              className="mt-2 text-sm text-ink underline underline-offset-4 hover:text-action-blue"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
