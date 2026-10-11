// Mock invoice list for the Invoices page. Amounts are in PKR (converted at PKR 280 per USD);
// vendor names are fictional companies styled on the Pakistani market.

export type InvoiceStatus = "paid" | "pending" | "overdue";

export type InvoiceRow = {
  id: string;
  vendor: string;
  po_number: string;
  issued: string; // YYYY-MM-DD
  amount: number; // PKR
  status: InvoiceStatus;
  synced: boolean;
};

export const INVOICES: InvoiceRow[] = [
  { id: "INV-2026-0418", vendor: "Indus Engineering Works", po_number: "PO-9921", issued: "2026-09-28", amount: 414260, status: "pending", synced: true },
  { id: "INV-2026-0417", vendor: "Mehran Logistics (Pvt) Ltd", po_number: "PO-9908", issued: "2026-09-26", amount: 2307200, status: "paid", synced: true },
  { id: "INV-2026-0415", vendor: "Ravi Steel Works", po_number: "PO-9874", issued: "2026-09-19", amount: 6612410, status: "overdue", synced: true },
  { id: "INV-2026-0412", vendor: "Margalla Packaging", po_number: "PO-9860", issued: "2026-09-15", amount: 873712, status: "paid", synced: false },
  { id: "INV-2026-0409", vendor: "Chenab Electronics", po_number: "PO-9851", issued: "2026-09-11", amount: 3354400, status: "pending", synced: true },
  { id: "INV-2026-0404", vendor: "Sutlej Chemicals", po_number: "PO-9822", issued: "2026-09-02", amount: 1807652, status: "paid", synced: true },
  { id: "INV-2026-0398", vendor: "Potohar Facility Services", po_number: "PO-9790", issued: "2026-08-24", amount: 616000, status: "overdue", synced: false },
];
