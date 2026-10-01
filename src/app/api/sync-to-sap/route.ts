import { NextResponse } from "next/server";
import { SAP_INBOUND_DIR, payloadFileName, type PayloadFormat, type SapPayload } from "@/lib/invoice";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isSapPayload(value: unknown): value is SapPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<SapPayload>;
  return (
    typeof payload.header?.vendor_name === "string" &&
    payload.header.vendor_name.length > 0 &&
    Array.isArray(payload.items) &&
    payload.items.length > 0 &&
    typeof payload.totals?.total === "number" &&
    typeof payload.meta?.generated_at === "string"
  );
}

export async function POST(request: Request) {
  let body: { format?: PayloadFormat; payload?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Request body must be JSON." }, { status: 400 });
  }

  const format: PayloadFormat = body.format === "xml" ? "xml" : "json";
  if (!isSapPayload(body.payload)) {
    return NextResponse.json(
      { success: false, message: "Payload needs a vendor, at least one line item and totals." },
      { status: 422 },
    );
  }

  // The browser saves the file to the user's device for copying into AL11. This route only
  // validates; a production version would push the serialised payload to the S3/SFTP share SAP reads.
  await sleep(1000);

  return NextResponse.json({
    success: true,
    message: "Payload is valid and ready for SAP AL11.",
    path: `${SAP_INBOUND_DIR}${payloadFileName(body.payload, format)}`,
  });
}
