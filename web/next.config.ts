import { existsSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

// Local settings live in one file for the whole repo: readkernel/.env, shared
// with the pipeline. Next.js only reads .env files in web/, so load that one
// too. Values already set (by Vercel, the shell or a web/.env.local) win.
// On Vercel there is no such file, and its own environment variables are used.
const rootEnv = path.resolve(process.cwd(), "..", ".env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
