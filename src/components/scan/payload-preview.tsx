"use client";

import { useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { payloadFileName, serializePayload, type PayloadFormat, type SapPayload } from "@/lib/invoice";
import { cn } from "@/lib/utils";

const KEY = "text-coral-soft";
const STRING = "text-[#b9ebb0]";
const NUMBER = "text-[#a9c3ff]";
const LITERAL = "text-[#a9c3ff]";
const PUNCT = "text-muted";

const JSON_TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;

function highlightJson(source: string) {
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of source.matchAll(JSON_TOKEN)) {
    const start = match.index;
    if (start > last) out.push(<span key={`p${start}`} className={PUNCT}>{source.slice(last, start)}</span>);
    const [token, quoted, colon] = match;
    if (quoted && colon) {
      out.push(<span key={start} className={KEY}>{quoted}</span>, <span key={`c${start}`} className={PUNCT}>{colon}</span>);
    } else if (quoted) {
      out.push(<span key={start} className={STRING}>{token}</span>);
    } else {
      out.push(<span key={start} className={/\d/.test(token) ? NUMBER : LITERAL}>{token}</span>);
    }
    last = start + token.length;
  }
  if (last < source.length) out.push(<span key="tail" className={PUNCT}>{source.slice(last)}</span>);
  return out;
}

function highlightXml(source: string) {
  return source.split(/(<[^>]+>)/g).map((part, i) => {
    if (!part) return null;
    if (part.startsWith("<")) return <span key={i} className={KEY}>{part}</span>;
    return <span key={i} className={part.trim() ? STRING : undefined}>{part}</span>;
  });
}

type Props = {
  payload: SapPayload;
  format: PayloadFormat;
  onFormatChange: (format: PayloadFormat) => void;
};

export function PayloadPreview({ payload, format, onFormatChange }: Props) {
  const [copied, setCopied] = useState(false);
  const source = serializePayload(payload, format);

  async function copy() {
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (permissions, insecure origin); the text is still selectable.
    }
  }

  return (
    <section aria-labelledby="payload-heading" className="flex min-h-0 flex-col overflow-hidden rounded-chip bg-primary text-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div className="min-w-0">
          <h2 id="payload-heading" className="font-mono text-[11px] uppercase tracking-[0.02em] text-coral-soft">
            Raw output
          </h2>
          <p className="mt-0.5 truncate font-mono text-xs text-white/80">/sap/inbound/{payloadFileName(payload, format)}</p>
        </div>
        <div className="flex items-center gap-2">
          <div role="radiogroup" aria-label="Payload format" className="flex rounded-pill border border-white/20 p-0.5">
            {(["json", "xml"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={format === option}
                onClick={() => onFormatChange(option)}
                className={cn(
                  "rounded-pill px-3 py-1 font-mono text-[11px] uppercase transition-colors",
                  format === option ? "bg-white text-primary" : "text-white/70 hover:text-white",
                )}
              >
                {option}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={copy}
            aria-label={copied ? "Copied payload" : "Copy payload"}
            className="grid size-8 place-items-center rounded-full border border-white/20 text-white/70 transition-colors hover:text-white"
          >
            {copied ? <Check className="size-3.5 text-[#b9ebb0]" /> : <Copy className="size-3.5" />}
          </button>
        </div>
      </div>
      <pre className="max-h-[32rem] overflow-auto p-5 font-mono text-xs leading-relaxed lg:max-h-[calc(100vh-14rem)]">
        <code>{format === "json" ? highlightJson(source) : highlightXml(source)}</code>
      </pre>
    </section>
  );
}
