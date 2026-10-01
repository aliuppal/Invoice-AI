// Invoq mark: a "q" built from a scan ring with a coral tail, read as both the letter and a lens.
export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="14" cy="14" r="8.5" fill="none" stroke="currentColor" strokeWidth="3.5" />
      <path d="M9.5 14h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.45" />
      <path d="M20.5 20.5 27 27" stroke="#ff7759" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={className ?? "flex items-center gap-2"}>
      <LogoMark />
      <span className="font-display text-[22px] leading-none tracking-[-0.04em]">invoq</span>
    </span>
  );
}
