"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { NAV_LINKS } from "@/components/nav-links";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
}

// Desktop: deep-green product band on the left. Mobile: bottom tab bar.
export function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-deep-green text-white md:flex">
        <Link href="/dashboard" className="flex h-[72px] items-center px-6" aria-label="Invoq dashboard">
          <Logo className="flex items-center gap-2 text-white" />
        </Link>
        <nav aria-label="Main" className="flex flex-1 flex-col gap-1 px-3 pt-4">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-pill px-4 py-2.5 text-sm transition-colors",
                  active ? "bg-white text-deep-green" : "text-white/75 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon className="size-4" strokeWidth={1.75} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="m-3 rounded-block border border-white/15 p-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.02em] text-white/60">SAP target</p>
          <p className="mt-1 font-mono text-sm text-white">/sap/inbound/</p>
        </div>
      </aside>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-hairline bg-white/95 backdrop-blur-md md:hidden"
      >
        {NAV_LINKS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px]",
                active ? "font-medium text-deep-green" : "text-slate",
              )}
            >
              <Icon className="size-5" strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
