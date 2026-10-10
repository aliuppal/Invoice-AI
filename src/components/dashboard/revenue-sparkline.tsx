"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/utils";

type Point = { month: string; value: number };

const W = 148;
const H = 56;
const PAD_X = 6;
const PAD_Y = 8;

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
}

// Single-series trend on the deep-green revenue card: thin line, the current period
// marked in the accent, hover/focus readout instead of axes.
export function RevenueSparkline({ data }: { data: Point[] }) {
  const [active, setActive] = useState<number | null>(null);
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const x = (i: number) => PAD_X + (i * (W - 2 * PAD_X)) / Math.max(1, data.length - 1);
  const y = (v: number) => PAD_Y + (1 - (v - min) / (max - min || 1)) * (H - 2 * PAD_Y);
  const path = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");
  const shown = active ?? data.length - 1;
  const step = (W - 2 * PAD_X) / Math.max(1, data.length - 1);

  return (
    <figure className="w-[9.25rem] shrink-0">
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="block overflow-visible"
        role="img"
        aria-label={`Revenue, ${monthLabel(data[0].month)} to ${monthLabel(data[data.length - 1].month)}`}
        onMouseLeave={() => setActive(null)}
      >
        {active !== null && (
          <line x1={x(active)} x2={x(active)} y1={2} y2={H - 2} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
        )}
        <path d={path} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(shown)} cy={y(data[shown].value)} r={4} fill="#ff7759" stroke="#003c33" strokeWidth={2} />
        {data.map((d, i) => (
          // Hit targets: one full-height column per month, wider than the mark.
          <rect
            key={d.month}
            x={x(i) - step / 2}
            y={0}
            width={step}
            height={H}
            fill="transparent"
            onMouseEnter={() => setActive(i)}
          />
        ))}
      </svg>
      <figcaption className="mt-1.5 flex items-baseline justify-between gap-2 font-mono text-[11px] text-white/70" aria-live="polite">
        <span>{monthLabel(data[shown].month)}</span>
        <span className="text-white">{formatMoney(data[shown].value)}</span>
      </figcaption>
      {/* Table view of the same series for screen readers. */}
      <table className="sr-only">
        <caption>Monthly revenue</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.month}>
              <th scope="row">{monthLabel(d.month)}</th>
              <td>{formatMoney(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
