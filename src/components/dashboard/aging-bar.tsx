"use client";

import { useState } from "react";
import type { AgingBucketId } from "@/lib/sap-invoices";
import { cn, formatMoney } from "@/lib/utils";

export type AgingSlice = { id: AgingBucketId; label: string; color: string; amount: number; count: number };

type Props = {
  slices: AgingSlice[];
  active: AgingBucketId | null;
  onSelect: (id: AgingBucketId | null) => void;
};

// Outstanding balance split by age: a segmented bar (2px surface gaps, 4px rounded ends)
// plus a legend that carries the values and doubles as the bucket filter.
export function AgingBar({ slices, active, onSelect }: Props) {
  const [hovered, setHovered] = useState<AgingBucketId | null>(null);
  const total = slices.reduce((sum, s) => sum + s.amount, 0);
  const visible = slices.filter((s) => s.amount > 0);
  const focus = hovered ?? active;

  return (
    <div>
      <div className="flex h-6 items-center gap-[2px]" onMouseLeave={() => setHovered(null)}>
        {visible.map((slice, i) => (
          <button
            key={slice.id}
            type="button"
            onClick={() => onSelect(active === slice.id ? null : slice.id)}
            onMouseEnter={() => setHovered(slice.id)}
            aria-label={`${slice.label}: ${formatMoney(slice.amount)}, ${slice.count} invoices`}
            aria-pressed={active === slice.id}
            className="flex h-full items-center"
            style={{ width: `${(slice.amount / total) * 100}%` }}
          >
            <span
              className={cn(
                "block h-3 w-full transition-opacity",
                i === 0 && "rounded-l-[4px]",
                i === visible.length - 1 && "rounded-r-[4px]",
                focus && focus !== slice.id && "opacity-35",
              )}
              style={{ backgroundColor: slice.color }}
            />
          </button>
        ))}
      </div>

      <ul className="mt-2 space-y-0.5">
        {slices.map((slice) => (
          <li key={slice.id}>
            <button
              type="button"
              onClick={() => onSelect(active === slice.id ? null : slice.id)}
              onMouseEnter={() => setHovered(slice.id)}
              onMouseLeave={() => setHovered(null)}
              aria-pressed={active === slice.id}
              disabled={slice.count === 0}
              className={cn(
                "flex w-full items-center gap-2 rounded-chip px-2 py-1 text-left text-xs transition-colors disabled:opacity-50",
                focus === slice.id ? "bg-white" : "hover:bg-white/60",
                active === slice.id && "ring-1 ring-primary",
              )}
            >
              <span aria-hidden className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: slice.color }} />
              <span className="flex-1 whitespace-nowrap text-body-muted">{slice.label}</span>
              <span className="whitespace-nowrap font-mono tabular-nums text-ink">{formatMoney(slice.amount)}</span>
              <span className="w-5 text-right font-mono tabular-nums text-slate">{slice.count}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
