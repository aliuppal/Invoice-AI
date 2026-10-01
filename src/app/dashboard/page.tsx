import Link from "next/link";
import { ArrowRight, ScanLine } from "lucide-react";
import { StatusTag } from "@/components/status-tag";
import { INVOICES, STATS } from "@/lib/mock-data";
import { formatDate, formatMoney } from "@/lib/utils";

export default function DashboardPage() {
  const recent = INVOICES.slice(0, 5);

  return (
    <div className="space-y-14">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.02em] text-slate">Accounts payable · Oct 2026</p>
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

      <section aria-label="Key figures" className="grid gap-4 md:grid-cols-4">
        <article className="flex flex-col justify-between rounded-media bg-deep-green p-7 text-white md:col-span-2">
          <h2 className="font-mono text-xs uppercase tracking-[0.02em] text-white/70">Total Revenue</h2>
          <div className="mt-10">
            <p className="font-display text-5xl leading-none tabular-nums tracking-[-0.03em] sm:text-6xl">
              {formatMoney(STATS.revenue.value)}
            </p>
            <p className="mt-4 text-sm text-white/75">
              <span className="text-white">{STATS.revenue.delta}</span> {STATS.revenue.note}
            </p>
          </div>
        </article>

        <article className="flex flex-col justify-between rounded-media bg-stone p-7">
          <h2 className="font-mono text-xs uppercase tracking-[0.02em] text-body-muted">Outstanding</h2>
          <div className="mt-10">
            <p className="font-display text-3xl leading-none tabular-nums tracking-[-0.02em] text-black">
              {formatMoney(STATS.outstanding.value)}
            </p>
            <p className="mt-3 text-sm text-body-muted">
              {STATS.outstanding.invoices} invoices · <span className="text-error">{STATS.outstanding.overdue} overdue</span>
            </p>
          </div>
        </article>

        <article className="flex flex-col justify-between rounded-media bg-stone p-7">
          <div className="flex items-start justify-between gap-2">
            <h2 className="font-mono text-xs uppercase tracking-[0.02em] text-body-muted">Processed via SAP</h2>
            <span className="rounded-pill border border-coral px-2 py-0.5 font-mono text-[10px] uppercase text-[#c2410c]">AL11</span>
          </div>
          <div className="mt-10">
            <p className="font-display text-3xl leading-none tabular-nums tracking-[-0.02em] text-black">
              {STATS.processed.value.toLocaleString("en-US")}
            </p>
            <p className="mt-3 text-sm text-body-muted">
              {STATS.processed.rate} {STATS.processed.note}
            </p>
          </div>
        </article>
      </section>

      <section className="grid gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="flex items-baseline justify-between border-b border-hairline pb-4">
            <h2 className="font-display text-3xl tracking-[-0.02em] text-black">Recent activity</h2>
            <Link
              href="/dashboard/invoices"
              className="inline-flex items-center gap-1 text-sm text-ink underline underline-offset-4 hover:text-action-blue"
            >
              View all <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <ul className="divide-y divide-hairline border-b border-hairline">
            {recent.map((invoice) => (
              <li key={invoice.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 py-5 sm:grid-cols-[1fr_auto_6.5rem]">
                <div className="min-w-0">
                  <p className="truncate text-base text-black">{invoice.vendor}</p>
                  <p className="mt-1 font-mono text-xs text-slate">
                    {invoice.id} · {formatDate(invoice.issued)}
                  </p>
                </div>
                <p className="text-right font-mono text-sm tabular-nums text-ink">{formatMoney(invoice.amount)}</p>
                <div className="col-span-2 sm:col-span-1 sm:text-right">
                  <StatusTag status={invoice.status} />
                </div>
              </li>
            ))}
          </ul>
        </div>

        <aside className="flex flex-col justify-between rounded-chip bg-primary p-6 text-white">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.02em] text-coral-soft">SAP inbound folder</p>
            <h2 className="mt-3 font-display text-2xl tracking-[-0.02em]">Files land here. AL11 reads them.</h2>
            <dl className="mt-6 space-y-3 border-t border-white/15 pt-5 font-mono text-xs">
              <div className="flex justify-between gap-4">
                <dt className="text-white/60">path</dt>
                <dd>/sap/inbound/</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-white/60">last write</dt>
                <dd>INV_PO-9921.json</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-white/60">queue</dt>
                <dd className="inline-flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-[#7fdc8f]" aria-hidden /> 0 pending
                </dd>
              </div>
            </dl>
          </div>
          <Link
            href="/dashboard/scan"
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-pill bg-white px-6 py-3 text-sm font-medium text-primary transition-colors hover:bg-stone"
          >
            Open Scan & Sync <ArrowRight className="size-4" />
          </Link>
        </aside>
      </section>
    </div>
  );
}
