import { Check, Minus } from "lucide-react";
import { StatusTag } from "@/components/status-tag";
import { INVOICES } from "@/lib/mock-data";
import { formatDate, formatMoney } from "@/lib/utils";

export default function InvoicesPage() {
  return (
    <div className="space-y-10">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.02em] text-slate">{INVOICES.length} documents</p>
        <h1 className="mt-3 font-display text-5xl leading-none tracking-[-0.03em] text-black sm:text-6xl">Invoices</h1>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] text-left text-sm">
          <thead className="border-b border-hairline font-mono text-[11px] uppercase tracking-[0.02em] text-slate">
            <tr>
              <th scope="col" className="py-3 pr-5 font-normal">Invoice</th>
              <th scope="col" className="px-5 py-3 font-normal">Vendor</th>
              <th scope="col" className="px-5 py-3 font-normal">PO</th>
              <th scope="col" className="px-5 py-3 font-normal">Issued</th>
              <th scope="col" className="px-5 py-3 text-right font-normal">Amount</th>
              <th scope="col" className="px-5 py-3 font-normal">Status</th>
              <th scope="col" className="py-3 pl-5 font-normal">SAP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {INVOICES.map((invoice) => (
              <tr key={invoice.id}>
                <td className="py-5 pr-5 font-mono text-xs text-body-muted">{invoice.id}</td>
                <td className="px-5 py-5 text-base text-black">{invoice.vendor}</td>
                <td className="px-5 py-5 font-mono text-xs text-body-muted">{invoice.po_number}</td>
                <td className="px-5 py-5 text-body-muted">{formatDate(invoice.issued)}</td>
                <td className="px-5 py-5 text-right font-mono tabular-nums">{formatMoney(invoice.amount)}</td>
                <td className="px-5 py-5">
                  <StatusTag status={invoice.status} />
                </td>
                <td className="py-5 pl-5">
                  {invoice.synced ? (
                    <span className="inline-flex items-center gap-1 text-xs text-deep-green">
                      <Check className="size-3.5" /> Synced
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-slate">
                      <Minus className="size-3.5" /> Not synced
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
