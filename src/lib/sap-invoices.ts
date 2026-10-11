// Mock supplier-invoice data shaped like an SAP S/4HANA response
// (API_SUPPLIERINVOICE_PROCESS_SRV, flattened), plus Invoq's sync and aging fields.
// Replace MOCK_SAP_INVOICES with the real API response; everything on the dashboard derives from it.

export type PaymentStatus = "Paid" | "Open" | "Overdue";
export type SapSyncStatus = "Synced" | "Pending" | "Failed";

export type SapSyncError = {
  code: string; // SAP message class/number, e.g. "M8/608"
  message: string;
  // Transient errors (locks, closed periods reopened, timeouts) clear on retry;
  // master-data errors need someone to fix the data in SAP first.
  retryable: boolean;
};

export type SapInvoice = {
  InvoiceID: string; // supplier's invoice number (SAP: SupplierInvoiceIDByInvcgParty)
  SAPDocumentNumber: string; // SAP: SupplierInvoice
  SAPDocumentType: "RE" | "KR"; // SAP: AccountingDocumentType
  Vendor: string; // SAP: InvoicingPartyName
  Date: string; // document date, YYYY-MM-DD (SAP: DocumentDate)
  Amount: number; // SAP: InvoiceGrossAmount
  Currency: string; // SAP: DocumentCurrency
  Status: PaymentStatus;
  SAPSyncStatus: SapSyncStatus;
  SyncError: SapSyncError | null;
  AgingDays: number; // days past the net due date; 0 while not yet due or once paid
};

// Dashboard "today" for the mock data; aging days below are computed against it.
export const AS_OF_DATE = "2026-10-11";

// Amounts are in PKR, converted from the original USD demo figures at this rate.
// Vendor names are fictional companies styled on the Pakistani market.
export const DEMO_USD_TO_PKR = 280;

export const MOCK_SAP_INVOICES: SapInvoice[] = [
  { InvoiceID: "INV-2026-0433", SAPDocumentNumber: "5105600433", SAPDocumentType: "RE", Vendor: "Sialkot Precision Fasteners", Date: "2026-10-10", Amount: 648200, Currency: "PKR", Status: "Open", SAPSyncStatus: "Pending", SyncError: null, AgingDays: 0 },
  { InvoiceID: "INV-2026-0431", SAPDocumentNumber: "5105600431", SAPDocumentType: "RE", Vendor: "Indus Engineering Works", Date: "2026-10-08", Amount: 414260, Currency: "PKR", Status: "Open", SAPSyncStatus: "Synced", SyncError: null, AgingDays: 0 },
  { InvoiceID: "INV-2026-0430", SAPDocumentNumber: "5105600430", SAPDocumentType: "RE", Vendor: "Mehran Logistics (Pvt) Ltd", Date: "2026-10-06", Amount: 2307200, Currency: "PKR", Status: "Paid", SAPSyncStatus: "Synced", SyncError: null, AgingDays: 0 },
  {
    InvoiceID: "INV-2026-0428", SAPDocumentNumber: "5105600428", SAPDocumentType: "RE", Vendor: "Ravi Steel Works", Date: "2026-10-03", Amount: 3542000, Currency: "PKR", Status: "Open", SAPSyncStatus: "Failed",
    SyncError: { code: "M8/608", message: "Vendor 100482 is not created in company code 1000.", retryable: false },
    AgingDays: 0,
  },
  { InvoiceID: "INV-2026-0425", SAPDocumentNumber: "5105600425", SAPDocumentType: "RE", Vendor: "Margalla Packaging", Date: "2026-09-29", Amount: 873712, Currency: "PKR", Status: "Paid", SAPSyncStatus: "Synced", SyncError: null, AgingDays: 0 },
  { InvoiceID: "INV-2026-0422", SAPDocumentNumber: "5105600422", SAPDocumentType: "RE", Vendor: "Chenab Electronics", Date: "2026-09-24", Amount: 3354400, Currency: "PKR", Status: "Open", SAPSyncStatus: "Synced", SyncError: null, AgingDays: 0 },
  { InvoiceID: "INV-2026-0419", SAPDocumentNumber: "5105600419", SAPDocumentType: "RE", Vendor: "Sutlej Chemicals", Date: "2026-09-18", Amount: 1807652, Currency: "PKR", Status: "Paid", SAPSyncStatus: "Synced", SyncError: null, AgingDays: 0 },
  { InvoiceID: "INV-2026-0415", SAPDocumentNumber: "5105600415", SAPDocumentType: "KR", Vendor: "Potohar Facility Services", Date: "2026-09-10", Amount: 616000, Currency: "PKR", Status: "Overdue", SAPSyncStatus: "Pending", SyncError: null, AgingDays: 1 },
  { InvoiceID: "INV-2026-0411", SAPDocumentNumber: "5105600411", SAPDocumentType: "RE", Vendor: "Faisalabad Industrial Supply", Date: "2026-09-02", Amount: 1365070, Currency: "PKR", Status: "Overdue", SAPSyncStatus: "Synced", SyncError: null, AgingDays: 9 },
  { InvoiceID: "INV-2026-0407", SAPDocumentNumber: "5105600407", SAPDocumentType: "RE", Vendor: "Ravi Steel Works", Date: "2026-08-21", Amount: 6612410, Currency: "PKR", Status: "Overdue", SAPSyncStatus: "Synced", SyncError: null, AgingDays: 21 },
  {
    InvoiceID: "INV-2026-0402", SAPDocumentNumber: "5105600402", SAPDocumentType: "RE", Vendor: "Karakoram Freight", Date: "2026-08-04", Amount: 1514968, Currency: "PKR", Status: "Overdue", SAPSyncStatus: "Failed",
    SyncError: { code: "M3/897", message: "Purchase order 4500018822 is locked by another user.", retryable: true },
    AgingDays: 38,
  },
  { InvoiceID: "INV-2026-0396", SAPDocumentNumber: "5105600396", SAPDocumentType: "RE", Vendor: "Quetta Tooling Co.", Date: "2026-07-20", Amount: 2055200, Currency: "PKR", Status: "Overdue", SAPSyncStatus: "Synced", SyncError: null, AgingDays: 53 },
  { InvoiceID: "INV-2026-0388", SAPDocumentNumber: "5105600388", SAPDocumentType: "KR", Vendor: "Kirthar Utilities", Date: "2026-07-02", Amount: 549024, Currency: "PKR", Status: "Overdue", SAPSyncStatus: "Synced", SyncError: null, AgingDays: 71 },
  { InvoiceID: "INV-2026-0384", SAPDocumentNumber: "5105600384", SAPDocumentType: "RE", Vendor: "Mehran Logistics (Pvt) Ltd", Date: "2026-06-26", Amount: 2765000, Currency: "PKR", Status: "Paid", SAPSyncStatus: "Synced", SyncError: null, AgingDays: 0 },
  {
    InvoiceID: "INV-2026-0379", SAPDocumentNumber: "5105600379", SAPDocumentType: "RE", Vendor: "Margalla Packaging", Date: "2026-06-15", Amount: 1086442, Currency: "PKR", Status: "Overdue", SAPSyncStatus: "Failed",
    SyncError: { code: "F5/201", message: "Posting period 006/2026 is not open.", retryable: true },
    AgingDays: 88,
  },
];

// Monthly invoiced totals (PKR) for the revenue sparkline, oldest first.
export const REVENUE_TREND: { month: string; value: number }[] = [
  { month: "2026-04", value: 61992000 },
  { month: "2026-05", value: 66906000 },
  { month: "2026-06", value: 68913600 },
  { month: "2026-07", value: 67138400 },
  { month: "2026-08", value: 70974400 },
  { month: "2026-09", value: 79774898 },
];

// First-pass sync results for the period. The rate is historical; what needs action
// now is whatever is still Failed in the invoice list.
export const SYNC_PERIOD = { attempted: 1233, firstPassFailures: 27 };

export const SAP_DOCUMENT_TYPES: Record<SapInvoice["SAPDocumentType"], string> = {
  RE: "Supplier invoice (gross, purchase-order based)",
  KR: "Vendor invoice (without purchase order)",
};

export type AgingBucketId = "current" | "1-30" | "31-60" | "60+";

export const AGING_BUCKETS: { id: AgingBucketId; label: string; color: string }[] = [
  // Single-hue ordinal ramp, light -> dark with age; validated against the stone card surface.
  { id: "current", label: "Current", color: "#e48a6e" },
  { id: "1-30", label: "1–30 days", color: "#cf5a34" },
  { id: "31-60", label: "31–60 days", color: "#a63c1a" },
  { id: "60+", label: "60+ days", color: "#6e220b" },
];

export function agingBucket(invoice: SapInvoice): AgingBucketId | null {
  if (invoice.Status === "Paid") return null;
  if (invoice.AgingDays <= 0) return "current";
  if (invoice.AgingDays <= 30) return "1-30";
  if (invoice.AgingDays <= 60) return "31-60";
  return "60+";
}

export function isOverdue(invoice: SapInvoice) {
  return invoice.Status !== "Paid" && invoice.AgingDays > 0;
}

// Mock of POST /sap/sync/retry. Transient errors clear; master-data errors come back unchanged.
export async function retrySapSync(invoice: SapInvoice): Promise<SapInvoice> {
  await new Promise((resolve) => setTimeout(resolve, 900 + Math.random() * 600));
  if (invoice.SyncError && !invoice.SyncError.retryable) return invoice;
  return { ...invoice, SAPSyncStatus: "Synced", SyncError: null };
}
