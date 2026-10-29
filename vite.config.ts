import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const { d1, r2 } = hostingConfig;
const PLACEHOLDER_DATABASE_ID = "00000000-0000-4000-8000-000000000000";

export default defineConfig(async () => {
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";
  const externalAssetBase = process.env.VITE_ASSET_BASE?.trim();
  const { cloudflare } = await import("@cloudflare/vite-plugin");
  return {
    base: './',
    // Sites production loads the large, public teaching images from GitHub
    // Pages. Local development keeps Vite's normal public/ directory so the
    // same source paths continue to work without a network dependency.
    publicDir: externalAssetBase ? false : "public",
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: {
          main: "./worker/index.ts",
          compatibility_flags: ["nodejs_compat"],
          d1_databases: d1 ? [{ binding: d1, database_name: "site-creator-d1", database_id: PLACEHOLDER_DATABASE_ID }] : [],
          r2_buckets: r2 ? [{ binding: r2, bucket_name: "site-creator-r2" }] : [],
        },
      }),
    ],
  };
});
