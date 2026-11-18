import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  // Det finns en package.json i mappen ovanför. Utan den här raden tror Next.js
  // att hela den mappen är projektet.
  turbopack: { root: path.join(__dirname) },
};

export default nextConfig;
