import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// The workspace books in Pakistani rupees: "Rs 1,234,567", whole rupees as on PKR invoices.
// Other currencies keep their usual two decimals.
export function formatMoney(value: number, currency = "PKR") {
  const pkr = currency === "PKR";
  return new Intl.NumberFormat(pkr ? "en-PK" : "en-US", {
    style: "currency",
    currency,
    ...(pkr && { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
  }).format(value);
}

// "Rs 13.8M" style for headline figures.
export function formatMoneyCompact(value: number, currency = "PKR") {
  return new Intl.NumberFormat(currency === "PKR" ? "en-PK" : "en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

// Dates are stored as YYYY-MM-DD; format in UTC so server and client agree.
export function formatDate(isoDate: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${isoDate}T00:00:00Z`),
  );
}
