// SAP CPI connection settings. Kept in this browser's localStorage (there's no database in
// the MVP), so each device configures its own connection.

export type CpiConfig = {
  endpoint: string; // iFlow HTTPS sender address, e.g. https://<tenant>.it-cpi.<region>.hana.ondemand.com/http/invoq/invoices
  username: string;
  password: string;
  // CPI's HTTPS sender can require a CSRF token; when on, Invoq fetches one before each push.
  csrf: boolean;
  updatedAt: string;
};

const CONFIG_KEY = "invoq.cpi.config";
const UNLOCK_KEY = "invoq.cpi.unlocked";

export function loadCpiConfig(): CpiConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    const config = JSON.parse(raw) as CpiConfig;
    return config.endpoint && config.username ? config : null;
  } catch {
    return null;
  }
}

export function saveCpiConfig(config: Omit<CpiConfig, "updatedAt">) {
  const stored: CpiConfig = { ...config, updatedAt: new Date().toISOString() };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(stored));
  return stored;
}

export function clearCpiConfig() {
  try {
    localStorage.removeItem(CONFIG_KEY);
  } catch {
    // Storage unavailable (private mode): nothing to clear.
  }
}

// The settings page stays unlocked for the rest of this browser tab session.
export function isCpiSettingsUnlocked() {
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

export function markCpiSettingsUnlocked() {
  try {
    sessionStorage.setItem(UNLOCK_KEY, "1");
  } catch {
    // Without sessionStorage the page simply asks again next time.
  }
}
