export type InvoiceStatus = "paid" | "pending" | "overdue";

export type InvoiceRow = {
  id: string;
  vendor: string;
  po_number: string;
  issued: string; // YYYY-MM-DD
  amount: number;
  status: InvoiceStatus;
  synced: boolean;
};

export const INVOICES: InvoiceRow[] = [
  { id: "INV-2026-0418", vendor: "Acme Corp", po_number: "PO-9921", issued: "2026-09-28", amount: 1479.5, status: "pending", synced: true },
  { id: "INV-2026-0417", vendor: "Northwind Logistics", po_number: "PO-9908", issued: "2026-09-26", amount: 8240.0, status: "paid", synced: true },
  { id: "INV-2026-0415", vendor: "Kestrel Steelworks", po_number: "PO-9874", issued: "2026-09-19", amount: 23615.75, status: "overdue", synced: true },
  { id: "INV-2026-0412", vendor: "Halcyon Packaging", po_number: "PO-9860", issued: "2026-09-15", amount: 3120.4, status: "paid", synced: false },
  { id: "INV-2026-0409", vendor: "Orbital Electronics", po_number: "PO-9851", issued: "2026-09-11", amount: 11980.0, status: "pending", synced: true },
  { id: "INV-2026-0404", vendor: "Meridian Chemicals", po_number: "PO-9822", issued: "2026-09-02", amount: 6455.9, status: "paid", synced: true },
  { id: "INV-2026-0398", vendor: "Atlas Facility Services", po_number: "PO-9790", issued: "2026-08-24", amount: 2200.0, status: "overdue", synced: false },
];

export const STATS = {
  revenue: { value: 284_910.35, delta: "+12.4%", note: "vs. August" },
  outstanding: { value: 38_766.25, invoices: 11, overdue: 3 },
  processed: { value: 1_206, rate: "97.8%", note: "first-pass sync success" },
};
