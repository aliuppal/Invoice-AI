"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AlertTriangle, Loader2, RotateCw, ScanLine } from "lucide-react";
import { AgingBar, type AgingSlice } from "@/components/dashboard/aging-bar";
import { EMPTY_FILTERS, InvoiceTable, type InvoiceFilters } from "@/components/dashboard/invoice-table";
import { RevenueSparkline } from "@/components/dashboard/revenue-sparkline";
import { Tooltip } from "@/components/ui/tooltip";
import {
  AGING_BUCKETS,
  MOCK_SAP_INVOICES,
  REVENUE_TREND,
  SAP_DOCUMENT_TYPES,
  SYNC_PERIOD,
  agingBucket,
  isOverdue,
  retrySapSync,
  type SapInvoice,
} from "@/lib/sap-invoices";
import { formatMoney } from "@/lib/utils";

const LABEL = "font-mono text-xs uppercase tracking-[0.02em]";

function monthName(month: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
}

export function DashboardView() {
  const [invoices, setInvoices] = useState<SapInvoice[]>(MOCK_SAP_INVOICES);
  const [filters, setFilters] = useState<InvoiceFilters>(EMPTY_FILTERS);
  const [retrying, setRetrying] = useState<ReadonlySet<string>>(new Set());
  const [retryResult, setRetryResult] = useState<string | null>(null);
  const tableRef = useRef<HTMLElement>(null);

  // Revenue
  const latest = REVENUE_TREND[REVENUE_TREND.length - 1];
  const previous = REVENUE_TREND[REVENUE_TREND.length - 2];
  const delta = (latest.value - previous.value) / previous.value;

  // Outstanding + aging
  const unpaid = invoices.filter((i) => i.Status !== "Paid");
  const outstanding = unpaid.reduce((sum, i) => sum + i.Amount, 0);
  const overdueCount = invoices.filter(isOverdue).length;
  const slices: AgingSlice[] = AGING_BUCKETS.map((b) => {
    const inBucket = unpaid.filter((i) => agingBucket(i) === b.id);
    return { ...b, amount: inBucket.reduce((sum, i) => sum + i.Amount, 0), count: inBucket.length };
  });

  // SAP sync
  const failed = invoices.filter((i) => i.SAPSyncStatus === "Failed");
  const firstPassRate = (SYNC_PERIOD.attempted - SYNC_PERIOD.firstPassFailures) / SYNC_PERIOD.attempted;
  const firstPassFailRate = SYNC_PERIOD.firstPassFailures / SYNC_PERIOD.attempted;
  const docTypes = [...new Set(invoices.map((i) => i.SAPDocumentType))].sort().reverse();

  function showInTable(patch: Partial<InvoiceFilters>) {
    setFilters({ ...EMPTY_FILTERS, ...patch });
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function retry(ids: string[]) {
    setRetryResult(null);
    setRetrying((prev) => new Set([...prev, ...ids]));
    const results = await Promise.all(
      ids.map(async (id) => {
        const invoice = invoices.find((i) => i.InvoiceID === id);
        if (!invoice) return null;
        try {
          return await retrySapSync(invoice);
        } catch {
          return invoice;
        }
      }),
    );
    const updated = results.filter((r): r is SapInvoice => r !== null);
    setInvoices((prev) => prev.map((inv) => updated.find((u) => u.InvoiceID === inv.InvoiceID) ?? inv));
    setRetrying((prev) => new Set([...prev].filter((id) => !ids.includes(id))));

    const stillFailing = updated.filter((u) => u.SAPSyncStatus === "Failed");
    const synced = updated.length - stillFailing.length;
    setRetryResult(
      stillFailing.length === 0
        ? `${synced} of ${updated.length} synced to SAP.`
        : `${synced} of ${updated.length} synced. Still failing: ${stillFailing.map((s) => s.SyncError?.message).join(" ")}`,
    );
  }

  return (
    <div className="space-y-14">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={`${LABEL} text-slate`}>Accounts payable · Oct 2026</p>
          <h1 className="mt-3 font-display text-5xl leading-none tracking-[-0.03em] text-black sm:text-6xl">Dashboard</h1>
        </div>
        <Link
          href="/dashboard/scan"
          className="inline-flex items-center justify-center gap-2 rounded-pill bg-primary px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-black"
        >
          <ScanLine className="size-4" strokeWidth={1.75} />
          Scan invoice
        </Link>
      </header>

      {/* Four across only when each stone card is wide enough for the aging legend; otherwise revenue
          takes a full row and the other two share the next. */}
      <section aria-label="Key figures" className="grid gap-4 md:grid-cols-2 wide:grid-cols-4">
        {/* Total revenue + 6-month trend */}
        <article className="flex flex-col justify-between gap-8 rounded-media bg-deep-green p-7 text-white md:col-span-2">
          <h2 className={`${LABEL} text-white/70`}>Total Revenue · {monthName(latest.month)}</h2>
          {/* Wraps the sparkline below the figure only when the card is too narrow for both. */}
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-6">
            <div>
              <p className="font-display text-5xl leading-none tabular-nums tracking-[-0.03em] sm:text-6xl wide:text-5xl 2xl:text-6xl">
                {formatMoney(latest.value)}
              </p>
              <p className="mt-4 text-sm text-white/75">
                <span className="text-white">
                  {delta >= 0 ? "+" : "−"}
                  {Math.abs(delta * 100).toFixed(1)}%
                </span>{" "}
                vs. {monthName(previous.month)}
              </p>
            </div>
            <RevenueSparkline data={REVENUE_TREND} />
          </div>
        </article>

        {/* Outstanding + aging buckets */}
        <article className="flex flex-col rounded-media bg-stone p-7">
          <h2 className={`${LABEL} text-body-muted`}>Outstanding</h2>
          <p className="mt-6 font-display text-3xl leading-none tabular-nums tracking-[-0.02em] text-black">
            {formatMoney(outstanding)}
          </p>
          <p className="mt-3 text-sm text-body-muted">
            {unpaid.length} invoices ·{" "}
            <button
              type="button"
              onClick={() => showInTable({ quick: "overdue" })}
              className="text-error underline underline-offset-4 hover:text-black"
            >
              {overdueCount} overdue
            </button>
          </p>
          <div className="mt-5">
            <AgingBar slices={slices} active={filters.bucket} onSelect={(bucket) => showInTable({ bucket })} />
          </div>
        </article>

        {/* SAP sync */}
        <article className="flex flex-col rounded-media bg-stone p-7">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className={`${LABEL} text-body-muted`}>Processed via SAP</h2>
            <Tooltip
              align="end"
              content={
                <>
                  Invoices post to SAP as these document types:
                  {docTypes.map((t) => (
                    <span key={t} className="mt-1 block">
                      <span className="font-mono text-coral-soft">{t}</span> · {SAP_DOCUMENT_TYPES[t]}
                    </span>
                  ))}
                  <span className="mt-1 block text-white/70">
                    Files are picked up from the SAP inbound folder (transaction AL11).
                  </span>
                </>
              }
              triggerClassName="border border-coral px-2 py-0.5 text-[11px] text-[#b4401f]"
            >
              SAP Document Type: {docTypes.join(", ")}
            </Tooltip>
          </div>
          <p className="mt-6 font-display text-3xl leading-none tabular-nums tracking-[-0.02em] text-black">
            {(SYNC_PERIOD.attempted - SYNC_PERIOD.firstPassFailures).toLocaleString("en-US")}
          </p>
          <p className="mt-3 text-sm text-body-muted">{(firstPassRate * 100).toFixed(1)}% first-pass sync success</p>

          <div className="mt-auto border-t border-hairline pt-4">
            {failed.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => showInTable({ quick: "failed" })}
                  className="inline-flex items-center gap-1 rounded-pill bg-error px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.02em] text-white hover:bg-[#8f0000]"
                >
                  <AlertTriangle className="size-3" aria-hidden />
                  {failed.length} failed
                </button>
                <button
                  type="button"
                  onClick={() => retry(failed.map((f) => f.InvoiceID))}
                  disabled={retrying.size > 0}
                  className="inline-flex items-center gap-1.5 rounded-pill bg-primary px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-black disabled:opacity-50"
                >
                  {retrying.size > 0 ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <RotateCw className="size-3.5" aria-hidden />
                  )}
                  {retrying.size > 0 ? "Retrying…" : "Retry Sync"}
                </button>
              </div>
            ) : (
              <p className="text-sm text-deep-green">All invoices are synced.</p>
            )}
            <p className="mt-2 text-xs text-slate">
              {SYNC_PERIOD.firstPassFailures} first-pass failures this period ({(firstPassFailRate * 100).toFixed(1)}%).
            </p>
            <p className="mt-1 text-xs text-ink" aria-live="polite">
              {retryResult}
            </p>
          </div>
        </article>
      </section>

      <section ref={tableRef} aria-labelledby="invoices-heading" className="scroll-mt-24">
        <div className="flex items-baseline justify-between border-b border-hairline pb-4">
          <h2 id="invoices-heading" className="font-display text-3xl tracking-[-0.02em] text-black">
            Invoices
          </h2>
          <Link href="/dashboard/invoices" className="text-sm text-ink underline underline-offset-4 hover:text-action-blue">
            Open full list
          </Link>
        </div>
        <div className="mt-5">
          <InvoiceTable
            invoices={invoices}
            filters={filters}
            onFiltersChange={setFilters}
            retrying={retrying}
            onRetry={(id) => retry([id])}
          />
        </div>
      </section>
    </div>
  );
}
