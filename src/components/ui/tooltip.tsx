"use client";

import { useId, useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  content: ReactNode;
  // Visible trigger content; defaults to an info icon (then `label` names it for screen readers).
  children?: ReactNode;
  label?: string;
  align?: "start" | "center" | "end";
  className?: string;
  triggerClassName?: string;
};

// Hover, focus or tap to show; Escape or blur to hide. The tooltip stays in the DOM
// (hidden) so aria-describedby always resolves.
export function Tooltip({ content, children, label, align = "center", className, triggerClassName }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-describedby={id}
        aria-label={children ? undefined : label}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        className={cn("inline-flex items-center gap-1 rounded-pill", triggerClassName)}
      >
        {children ?? <Info className="size-3.5" strokeWidth={1.75} aria-hidden />}
      </button>
      <span
        role="tooltip"
        id={id}
        hidden={!open}
        className={cn(
          "absolute bottom-full z-40 mb-2 w-64 rounded-chip bg-primary px-3 py-2 text-left font-sans text-xs normal-case leading-relaxed tracking-normal text-white shadow-lg",
          align === "center" && "left-1/2 -translate-x-1/2",
          align === "start" && "left-0",
          align === "end" && "right-0",
        )}
      >
        {content}
      </span>
    </span>
  );
}
