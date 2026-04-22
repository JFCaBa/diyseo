// @ts-nocheck
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { defineConfig } from "prisma/config";

function loadEnvFile(filename: string) {
  const filepath = resolve(process.cwd(), filename);

  if (!existsSync(filepath)) {
    return;
  }

  const contents = readFileSync(filepath, "utf8");

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();

    if (!key || process.env[key] !== undefined) {
      continue;
    }

    const unquoted = rawValue.replace(/^['"]|['"]$/g, "");
    process.env[key] = unquoted;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

export default defineConfig({
  schema: "prisma/schema.prisma",
  seed: "tsx prisma/seed.ts"
});
