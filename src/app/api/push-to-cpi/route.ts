import { NextResponse } from "next/server";

// Server-side relay to an SAP CPI iFlow. Browsers can't call CPI directly (no CORS on the
// HTTPS sender adapter), so the page sends the payload and credentials here and this route
// POSTs it to the configured endpoint with Basic auth.

export const maxDuration = 30;

const TIMEOUT_MS = 25_000;
const MAX_CONTENT_BYTES = 1024 * 1024;

type Body = {
  mode?: "push" | "test";
  endpoint?: string;
  username?: string;
  password?: string;
  csrf?: boolean;
  format?: "json" | "xml";
  fileName?: string;
  content?: string;
};

function badRequest(message: string) {
  return NextResponse.json({ ok: false, message }, { status: 400 });
}

// Only public HTTPS hosts: this route must not become a way to reach localhost or private networks.
function parseEndpoint(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const privateHost =
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(host) ||
    host.startsWith("[");
  return url.protocol === "https:" && !privateHost ? url : null;
}

// What a CPI status code usually means, phrased for the person configuring the connection.
function explain(status: number) {
  if (status >= 200 && status < 300) return "SAP CPI accepted the message.";
  if (status === 401) return "SAP CPI rejected the username or password (401).";
  if (status === 403) {
    return "The CPI user isn't allowed to call this iFlow (403). It needs the ESBMessaging.send role, or CSRF protection is on in the iFlow - enable the CSRF option in Invoq's CPI settings.";
  }
  if (status === 404) return "No deployed iFlow at that address (404). Check the endpoint path and that the iFlow is deployed.";
  if (status === 405) return "The endpoint is reachable but doesn't accept this method (405).";
  if (status >= 500) return `SAP CPI hit an error while processing the message (${status}). Check the iFlow's message monitor.`;
  return `SAP CPI responded with HTTP ${status}.`;
}

// CPI's CSRF protection: GET with "X-CSRF-Token: Fetch", then replay the token and session cookies.
async function fetchCsrf(url: URL, authorization: string) {
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: authorization, "X-CSRF-Token": "Fetch" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const token = res.headers.get("x-csrf-token");
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  return { status: res.status, token, cookie };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body) return badRequest("Request body must be JSON.");

  const url = parseEndpoint(body.endpoint ?? "");
  if (!url) return badRequest("Enter a public https:// endpoint for the iFlow.");
  if (!body.username || !body.password) return badRequest("Username and password are required.");

  const authorization = `Basic ${Buffer.from(`${body.username}:${body.password}`).toString("base64")}`;

  try {
    if (body.mode === "test") {
      // Checks the address and credentials without sending a message into the iFlow.
      const { status, token } = await fetchCsrf(url, authorization);
      const reachable = status !== 401 && status !== 403 && status !== 404 && status < 500;
      const message = reachable
        ? `Connected - credentials accepted (HTTP ${status}).${token ? " CSRF token issued." : ""}`
        : explain(status);
      return NextResponse.json({ ok: reachable, status, message });
    }

    const content = body.content ?? "";
    if (!content) return badRequest("Nothing to send.");
    if (Buffer.byteLength(content) > MAX_CONTENT_BYTES) return badRequest("Payload is larger than 1 MB.");

    const headers: Record<string, string> = {
      Authorization: authorization,
      "Content-Type": body.format === "xml" ? "application/xml" : "application/json",
      Accept: "application/json, application/xml, text/plain, */*",
    };
    // Readable in the iFlow when listed under the sender adapter's Allowed Header(s).
    if (body.fileName) headers["X-Invoq-File-Name"] = body.fileName;

    if (body.csrf) {
      const csrf = await fetchCsrf(url, authorization);
      if (!csrf.token) {
        return NextResponse.json({ ok: false, status: csrf.status, message: `Couldn't get a CSRF token. ${explain(csrf.status)}` });
      }
      headers["X-CSRF-Token"] = csrf.token;
      if (csrf.cookie) headers.Cookie = csrf.cookie;
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: content,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const responseText = (await res.text()).slice(0, 2000);
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      message: explain(res.status),
      // CPI returns this header so the message can be found in the monitor.
      messageId: res.headers.get("sap_messageprocessinglogid"),
      response: responseText,
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    console.error("[push-to-cpi] request failed", error);
    return NextResponse.json(
      {
        ok: false,
        status: 0,
        message: timedOut
          ? "SAP CPI didn't answer within 25 seconds."
          : "Couldn't reach the endpoint. Check the address and that the tenant is reachable from the internet.",
      },
      { status: 502 },
    );
  }
}
