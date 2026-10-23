import { access, cp, mkdir, readFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Plugin } from "vite";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export function sites(): Plugin {
  let root = process.cwd();
  return {
    name: "sites",
    apply: "build",
    configResolved(config) {
      root = config.root;
    },
    async closeBundle() {
      const outputDirectory = resolve(root, "dist", ".openai");
      const hostingConfig = resolve(root, ".openai", "hosting.json");
      // Reviewed lecture pages ship with the Site; legacy teaching assets remain on their existing CDN.
      const manifests = ["med-reviewed-lecture-evidence", "med-remaining-reviewed-lecture-evidence", "surgery-ortho-reviewed-lecture-evidence", "surgery-remaining-reviewed-lecture-evidence", "biochemistry-reviewed-lecture-evidence"];
      await rm(resolve(root, "dist", "client", "site-assets"), { recursive: true, force: true });
      for (const manifest of manifests) {
        const review = JSON.parse(await readFile(resolve(root, "src", "data", `${manifest}.json`), "utf8"));
        for (const page of Object.values(review.pages) as { image: string }[]) {
          const target = resolve(root, "dist", "client", page.image);
          await mkdir(dirname(target), { recursive: true });
          await cp(resolve(root, "public", page.image), target);
        }
      }
      const drizzleSource = resolve(root, "drizzle");
      await rm(outputDirectory, { recursive: true, force: true });
      await mkdir(outputDirectory, { recursive: true });
      if (await exists(hostingConfig)) await cp(hostingConfig, resolve(outputDirectory, "hosting.json"));
      if (await exists(drizzleSource)) await cp(drizzleSource, resolve(outputDirectory, "drizzle"), { recursive: true });
    },
  };
}
