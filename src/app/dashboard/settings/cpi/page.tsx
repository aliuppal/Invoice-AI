"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { ArrowLeft, Eye, EyeOff, Loader2, Lock, PlugZap, Save, Trash2 } from "lucide-react";
import {
  clearCpiConfig,
  isCpiSettingsUnlocked,
  loadCpiConfig,
  markCpiSettingsUnlocked,
  saveCpiConfig,
} from "@/lib/cpi-config";
import { cn } from "@/lib/utils";

const INPUT =
  "w-full rounded-[4px] border border-hairline bg-white px-3 py-2.5 text-sm text-black placeholder:text-muted transition-colors focus:border-form-focus focus:outline-none focus:ring-1 focus:ring-form-focus";
const PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-pill bg-primary px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40";
const SECONDARY =
  "inline-flex items-center justify-center gap-2 rounded-pill border border-primary px-6 py-3 text-sm font-medium text-primary transition-colors hover:bg-stone disabled:cursor-not-allowed disabled:opacity-40";

type Status = { kind: "ok" | "error"; text: string } | null;

// true only after hydration, so storage is read on the client without a server/client mismatch.
const subscribeNoop = () => () => {};
function useHydrated() {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

function StatusLine({ status }: { status: Status }) {
  if (!status) return null;
  return (
    <p
      role={status.kind === "error" ? "alert" : "status"}
      className={cn(
        "rounded-chip px-4 py-3 text-sm",
        status.kind === "ok" ? "bg-pale-green text-deep-green" : "bg-[#fff0ec] text-error",
      )}
    >
      {status.text}
    </p>
  );
}

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/cpi-unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error("wrong");
      markCpiSettingsUnlocked();
      onUnlock();
    } catch {
      setError("That password isn't right.");
      setPassword("");
    } finally {
      setChecking(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-md rounded-media border border-hairline bg-white p-8">
      <span className="grid size-12 place-items-center rounded-full bg-stone text-deep-green">
        <Lock className="size-5" strokeWidth={1.75} />
      </span>
      <h2 className="mt-5 font-display text-[28px] leading-tight tracking-[-0.02em] text-black">Enter password</h2>
      <p className="mt-1 text-sm text-body-muted">The SAP CPI connection settings are password protected.</p>
      <label htmlFor="cpi-unlock" className="mt-6 mb-1.5 block text-sm text-body-muted">
        Password
      </label>
      <input
        id="cpi-unlock"
        type="password"
        autoComplete="off"
        autoFocus
        className={INPUT}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && (
        <p role="alert" className="mt-2 text-sm text-error">
          {error}
        </p>
      )}
      <button type="submit" disabled={!password || checking} className={cn(PRIMARY, "mt-6 w-full")}>
        {checking ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" strokeWidth={1.75} />}
        Unlock
      </button>
    </form>
  );
}

function CpiForm() {
  // Rendered only after hydration, so reading localStorage here is safe.
  const [saved, setSaved] = useState(() => loadCpiConfig());
  const [endpoint, setEndpoint] = useState(saved?.endpoint ?? "");
  const [username, setUsername] = useState(saved?.username ?? "");
  const [password, setPassword] = useState(saved?.password ?? "");
  const [csrf, setCsrf] = useState(saved?.csrf ?? false);
  const [showPassword, setShowPassword] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const complete = endpoint.trim() && username.trim() && password;

  function save(event: FormEvent) {
    event.preventDefault();
    if (!/^https:\/\//i.test(endpoint.trim())) {
      setStatus({ kind: "error", text: "The endpoint must start with https://" });
      return;
    }
    try {
      setSaved(saveCpiConfig({ endpoint: endpoint.trim(), username: username.trim(), password, csrf }));
      setStatus({ kind: "ok", text: "Saved. The Push to SAP CPI button on the Scan page now uses this connection." });
    } catch {
      setStatus({ kind: "error", text: "This browser blocked saving settings (private mode?)." });
    }
  }

  async function test() {
    setTesting(true);
    setStatus(null);
    try {
      const res = await fetch("/api/push-to-cpi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "test", endpoint: endpoint.trim(), username: username.trim(), password, csrf }),
      });
      const json = await res.json();
      setStatus({ kind: json.ok ? "ok" : "error", text: json.message });
    } catch {
      setStatus({ kind: "error", text: "The connection test didn't complete. Try again." });
    } finally {
      setTesting(false);
    }
  }

  function clear() {
    clearCpiConfig();
    setSaved(null);
    setEndpoint("");
    setUsername("");
    setPassword("");
    setCsrf(false);
    setStatus({ kind: "ok", text: "Connection removed from this browser." });
  }

  return (
    <form onSubmit={save} className="rounded-media border border-hairline bg-white p-6 sm:p-8">
      <div className="grid gap-5">
        <div>
          <label htmlFor="cpi-endpoint" className="mb-1.5 block text-sm text-body-muted">
            iFlow endpoint
          </label>
          <input
            id="cpi-endpoint"
            type="url"
            inputMode="url"
            placeholder="https://<tenant>.it-cpi018-rt.cfapps.<region>.hana.ondemand.com/http/invoq/invoices"
            className={cn(INPUT, "font-mono")}
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
          />
          <p className="mt-1.5 text-xs text-slate">
            The HTTPS sender address of the deployed iFlow. Invoq POSTs the invoice JSON here.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="cpi-username" className="mb-1.5 block text-sm text-body-muted">
              Username
            </label>
            <input
              id="cpi-username"
              autoComplete="off"
              className={INPUT}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="cpi-password" className="mb-1.5 block text-sm text-body-muted">
              Password
            </label>
            <div className="relative">
              <input
                id="cpi-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                className={cn(INPUT, "pr-11")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate hover:text-black"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
        </div>

        <label className="flex items-start gap-3 text-sm text-ink">
          <input
            type="checkbox"
            checked={csrf}
            onChange={(e) => setCsrf(e.target.checked)}
            className="mt-0.5 size-4 accent-[#003c33]"
          />
          <span>
            CSRF protected
            <span className="block text-xs text-slate">
              Turn on if &quot;CSRF Protected&quot; is ticked in the iFlow&apos;s HTTPS sender adapter.
            </span>
          </span>
        </label>
      </div>

      <div className="mt-8 space-y-4 border-t border-hairline pt-6">
        <StatusLine status={status} />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
          {saved && (
            <button
              type="button"
              onClick={clear}
              className="inline-flex items-center gap-1.5 text-sm text-error underline underline-offset-4 sm:mr-auto"
            >
              <Trash2 className="size-4" /> Remove connection
            </button>
          )}
          <button type="button" onClick={test} disabled={!complete || testing} className={cn(SECONDARY, "sm:ml-auto")}>
            {testing ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" strokeWidth={1.75} />}
            Test connection
          </button>
          <button type="submit" disabled={!complete} className={PRIMARY}>
            <Save className="size-4" strokeWidth={1.75} />
            Save
          </button>
        </div>
        {saved && (
          <p className="text-xs text-slate">
            Last saved {new Date(saved.updatedAt).toLocaleString()}. Stored in this browser only.
          </p>
        )}
      </div>
    </form>
  );
}

export default function CpiSettingsPage() {
  const hydrated = useHydrated();
  const [unlockedNow, setUnlockedNow] = useState(false);
  const unlocked = unlockedNow || (hydrated && isCpiSettingsUnlocked());

  return (
    <div className="space-y-10">
      <header>
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-1.5 text-sm text-body-muted underline underline-offset-4 hover:text-black"
        >
          <ArrowLeft className="size-4" /> Settings
        </Link>
        <h1 className="mt-4 font-display text-5xl leading-none tracking-[-0.03em] text-black sm:text-6xl">SAP CPI</h1>
        <p className="mt-4 max-w-xl text-lg leading-snug text-body-muted">
          Where the Push to SAP CPI button sends invoices: an iFlow endpoint called with Basic authentication.
        </p>
      </header>

      {!hydrated ? null : unlocked ? <CpiForm /> : <PasswordGate onUnlock={() => setUnlockedNow(true)} />}
    </div>
  );
}
