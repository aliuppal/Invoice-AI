import { FileText, LayoutDashboard, ScanLine, Settings } from "lucide-react";

export const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/invoices", label: "Invoices", icon: FileText },
  { href: "/dashboard/scan", label: "Scan & Sync", icon: ScanLine },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
] as const;
