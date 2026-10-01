"use client";

import { useId, type InputHTMLAttributes } from "react";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { CURRENCIES, draftTotals, newLineId, toNumber, type DraftLineItem, type InvoiceDraft } from "@/lib/invoice";
import { cn, formatMoney } from "@/lib/utils";

const INPUT =
  "w-full rounded-[4px] border border-hairline bg-white px-3 py-2.5 text-sm text-black placeholder:text-muted transition-colors focus:border-form-focus focus:outline-none focus:ring-1 focus:ring-form-focus";

function Field({ label, className, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm text-body-muted">
        {label}
      </label>
      <input id={id} className={INPUT} {...props} />
    </div>
  );
}

type Props = {
  draft: InvoiceDraft;
  onChange: (draft: InvoiceDraft) => void;
};

export function ReviewForm({ draft, onChange }: Props) {
  const currencyId = useId();
  const taxId = useId();
  const { subtotal, total } = draftTotals(draft);
  const money = (n: number) => formatMoney(n, draft.currency);

  const set = <K extends keyof InvoiceDraft>(key: K, value: InvoiceDraft[K]) => onChange({ ...draft, [key]: value });

  const setItem = (id: string, patch: Partial<DraftLineItem>) =>
    set(
      "line_items",
      draft.line_items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );

  const addItem = () =>
    set("line_items", [...draft.line_items, { id: newLineId(), description: "", quantity: "1", unit_price: "0.00" }]);

  const removeItem = (id: string) =>
    set(
      "line_items",
      draft.line_items.filter((item) => item.id !== id),
    );

  return (
    <section aria-labelledby="review-heading" className="rounded-media border border-hairline bg-white p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="review-heading" className="font-display text-[32px] leading-tight tracking-[-0.02em] text-black">
            Extracted data
          </h2>
          <p className="mt-1 text-sm text-body-muted">Check every field before syncing. Edits update the payload live.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-pill border border-coral-soft bg-[#fff4f1] px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.02em] text-[#b4401f]">
          <Sparkles className="size-3" /> AI pre-filled
        </span>
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <Field
          label="Vendor Name"
          className="sm:col-span-2"
          value={draft.vendor}
          onChange={(e) => set("vendor", e.target.value)}
          autoComplete="organization"
        />
        <Field label="Invoice Number" value={draft.invoice_number} onChange={(e) => set("invoice_number", e.target.value)} />
        <Field label="Invoice Date" type="date" value={draft.invoice_date} onChange={(e) => set("invoice_date", e.target.value)} />
        <Field label="PO Number" value={draft.po_number} onChange={(e) => set("po_number", e.target.value)} />
        <div>
          <label htmlFor={currencyId} className="mb-1.5 block text-sm text-body-muted">
            Currency
          </label>
          <select id={currencyId} className={INPUT} value={draft.currency} onChange={(e) => set("currency", e.target.value)}>
            {CURRENCIES.map((code) => (
              <option key={code}>{code}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-10 border-t border-hairline pt-8">
        <div className="flex items-baseline justify-between">
          <h3 className="font-display text-2xl tracking-[-0.02em] text-black">Line items</h3>
          <span className="font-mono text-xs text-slate">{draft.line_items.length} rows</span>
        </div>

        <div
          aria-hidden
          className="mt-5 hidden grid-cols-[minmax(0,1fr)_4.5rem_6.5rem_6.5rem_2.5rem] gap-2 font-mono text-[11px] uppercase tracking-[0.02em] text-slate sm:grid"
        >
          <span>Description</span>
          <span>Qty</span>
          <span>Unit price</span>
          <span className="text-right">Amount</span>
          <span />
        </div>

        <ul className="mt-3 space-y-3 sm:mt-2 sm:space-y-2">
          {draft.line_items.map((item, i) => {
            const amount = toNumber(item.quantity) * toNumber(item.unit_price);
            const n = i + 1;
            return (
              <li
                key={item.id}
                className="grid grid-cols-[1fr_1fr_2.5rem] items-end gap-2 border-b border-hairline pb-4 sm:grid-cols-[minmax(0,1fr)_4.5rem_6.5rem_6.5rem_2.5rem] sm:items-center sm:border-0 sm:pb-0"
              >
                <label className="col-span-3 sm:col-span-1">
                  <span className="mb-1 block text-xs text-slate sm:sr-only">Line {n} description</span>
                  <input
                    className={INPUT}
                    value={item.description}
                    placeholder="Description"
                    onChange={(e) => setItem(item.id, { description: e.target.value })}
                  />
                </label>
                <label>
                  <span className="mb-1 block text-xs text-slate sm:sr-only">Line {n} quantity</span>
                  <input
                    className={cn(INPUT, "font-mono tabular-nums")}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    value={item.quantity}
                    onChange={(e) => setItem(item.id, { quantity: e.target.value })}
                  />
                </label>
                <label>
                  <span className="mb-1 block text-xs text-slate sm:sr-only">Line {n} unit price</span>
                  <input
                    className={cn(INPUT, "font-mono tabular-nums")}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e) => setItem(item.id, { unit_price: e.target.value })}
                  />
                </label>
                <p className="order-last col-span-3 text-right font-mono text-sm tabular-nums text-ink sm:order-none sm:col-span-1">
                  <span className="text-slate sm:hidden">Amount </span>
                  {money(amount)}
                </p>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  aria-label={`Remove line ${n}`}
                  className="grid size-10 place-items-center rounded-full text-slate transition-colors hover:bg-[#fff0ec] hover:text-error"
                >
                  <Trash2 className="size-4" strokeWidth={1.75} />
                </button>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={addItem}
          className="mt-5 inline-flex items-center gap-1.5 text-sm text-ink underline underline-offset-4 hover:text-action-blue"
        >
          <Plus className="size-4" /> Add line item
        </button>
      </div>

      <dl className="mt-10 ml-auto max-w-xs space-y-3 rounded-block bg-stone p-5 text-sm">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-body-muted">Subtotal</dt>
          <dd className="font-mono tabular-nums">{money(subtotal)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt>
            <label htmlFor={taxId} className="text-body-muted">
              Tax
            </label>
          </dt>
          <dd className="w-32">
            <input
              id={taxId}
              className={cn(INPUT, "text-right font-mono tabular-nums")}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={draft.tax}
              onChange={(e) => set("tax", e.target.value)}
            />
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-t border-hairline pt-3">
          <dt className="text-black">Total</dt>
          <dd className="font-display text-3xl tabular-nums tracking-[-0.02em] text-black">{money(total)}</dd>
        </div>
        <p className="text-right text-xs text-slate">Calculated from the line items.</p>
      </dl>
    </section>
  );
}
