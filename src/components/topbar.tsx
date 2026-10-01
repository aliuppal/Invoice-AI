import Link from "next/link";
import { Bell } from "lucide-react";
import { Logo } from "@/components/logo";

export function Topbar() {
  return (
    <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-hairline bg-white/90 px-4 backdrop-blur-md sm:px-6 lg:px-10">
      <Link href="/dashboard" className="md:hidden" aria-label="Invoq dashboard">
        <Logo className="flex items-center gap-2 text-primary" />
      </Link>
      <p className="hidden font-mono text-xs uppercase tracking-[0.02em] text-slate md:block">
        Workspace / <span className="text-ink">Finance Ops</span>
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Notifications, 2 unread"
          className="relative grid size-10 place-items-center rounded-full text-ink transition-colors hover:bg-stone"
        >
          <Bell className="size-5" strokeWidth={1.75} />
          <span aria-hidden className="absolute right-2.5 top-2.5 size-2 rounded-full bg-coral" />
        </button>
        <button
          type="button"
          aria-label="Account menu"
          className="flex items-center gap-3 rounded-pill py-1 pl-1 pr-3 transition-colors hover:bg-stone"
        >
          <span className="grid size-8 place-items-center rounded-full bg-deep-green text-xs font-medium text-white">FO</span>
          <span className="hidden text-left leading-tight sm:block">
            <span className="block text-sm text-ink">Finance Ops</span>
            <span className="block text-xs text-slate">Admin</span>
          </span>
        </button>
      </div>
    </header>
  );
}
