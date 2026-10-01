const SETTINGS = [
  {
    group: "SAP connection",
    rows: [
      { label: "Inbound directory", value: "/sap/inbound/", hint: "Folder SAP reads through transaction AL11." },
      { label: "Transport", value: "Download to device", hint: "Files are saved as <invoice no.>_<timestamp>; copy them into the AL11 directory." },
      { label: "Default payload format", value: "JSON", hint: "XML can be chosen per document on the Scan page." },
    ],
  },
  {
    group: "OCR",
    rows: [
      { label: "Engine", value: "Tesseract.js", hint: "Runs server-side in the scan API route." },
      { label: "Language", value: "eng", hint: "Images are OCR'd. PDFs use their text layer; scanned PDFs aren't supported yet." },
      { label: "Max upload size", value: "10 MB", hint: "PNG, JPG, WEBP, BMP, GIF or PDF." },
    ],
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-12">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.02em] text-slate">Read-only in MVP</p>
        <h1 className="mt-3 font-display text-5xl leading-none tracking-[-0.03em] text-black sm:text-6xl">Settings</h1>
      </header>

      {SETTINGS.map(({ group, rows }) => (
        <section key={group}>
          <h2 className="border-b border-hairline pb-4 font-display text-2xl tracking-[-0.02em] text-black">{group}</h2>
          <dl className="divide-y divide-hairline border-b border-hairline">
            {rows.map((row) => (
              <div key={row.label} className="grid gap-1 py-5 sm:grid-cols-[16rem_1fr] sm:gap-6">
                <dt className="text-sm text-body-muted">{row.label}</dt>
                <dd>
                  <p className="font-mono text-sm text-black">{row.value}</p>
                  <p className="mt-1 text-sm text-slate">{row.hint}</p>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
