import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

// tesseract.js and every package it depends on, found by walking package.json files.
function dependencyTree(root: string, seen = new Set<string>()) {
  if (seen.has(root)) return seen;
  const manifest = path.join(__dirname, "node_modules", root, "package.json");
  if (!fs.existsSync(manifest)) return seen;
  seen.add(root);
  const { dependencies = {} } = JSON.parse(fs.readFileSync(manifest, "utf8"));
  for (const dep of Object.keys(dependencies)) dependencyTree(dep, seen);
  return seen;
}

const nextConfig: NextConfig = {
  // tesseract.js spawns a worker thread from a path inside its own package;
  // bundling breaks that path, so load it with native Node `require` instead.
  serverExternalPackages: ["tesseract.js"],
  // That worker requires its script, its dependencies (bmp-js, node-fetch, ...) and the WASM
  // engine by path at runtime, which file tracing can't see. Ship the whole tree explicitly,
  // or serverless deploys crash with "Cannot find module" and OCR never finishes.
  outputFileTracingIncludes: {
    "/api/scan-invoice": [...dependencyTree("tesseract.js")].map((pkg) => `./node_modules/${pkg}/**/*`),
  },
  // C:\Claude_Demo has its own package-lock.json; pin the root to this app.
  turbopack: { root: path.join(__dirname) },
};

export default nextConfig;
