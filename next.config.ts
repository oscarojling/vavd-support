import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Det finns en package.json i mappen ovanför. Utan den här raden tror Next.js
  // att hela den mappen är projektet.
  turbopack: { root: path.join(__dirname) },
  // Agenterna läser butikens kodfiler och FACIT.md när de körs. Utan det här
  // tar Vercel inte med filerna i serverfunktionerna.
  outputFileTracingIncludes: {
    "/api/**/*": ["./butik/**/*", "./FACIT.md"],
  },
};

export default nextConfig;
