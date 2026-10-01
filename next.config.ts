import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // tesseract.js spawns a worker thread from a path inside its own package;
  // bundling breaks that path, so load it with native Node `require` instead.
  serverExternalPackages: ["tesseract.js"],
  // C:\Claude_Demo has its own package-lock.json; pin the root to this app.
  turbopack: { root: path.join(__dirname) },
};

export default nextConfig;
