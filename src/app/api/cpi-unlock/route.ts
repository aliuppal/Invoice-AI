import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

// Password for the SAP CPI settings page. Checked here so it never ships in the browser bundle;
// override it with the CPI_SETTINGS_PASSWORD environment variable.
const SETTINGS_PASSWORD = process.env.CPI_SETTINGS_PASSWORD || "12345";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { password?: unknown } | null;
  const attempt = Buffer.from(typeof body?.password === "string" ? body.password : "");
  const expected = Buffer.from(SETTINGS_PASSWORD);
  const ok = attempt.length === expected.length && timingSafeEqual(attempt, expected);

  // Slow down guessing a little.
  if (!ok) await sleep(600);
  return NextResponse.json({ ok }, { status: ok ? 200 : 401 });
}
