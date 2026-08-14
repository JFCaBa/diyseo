/**
 * Mint a Publishing API key for local WordPress-plugin integration testing.
 *
 * The key is normally created through the authenticated admin UI (Settings > API),
 * which requires a Google session. For local testing this script inserts a key
 * directly against the database so you can point the DIYSEO Sync WordPress plugin
 * at a running dev server without going through OAuth.
 *
 * Usage:
 *   npm run mint:api-key                 # first site in the DB
 *   npm run mint:api-key -- <siteId>     # a specific site
 *   npm run mint:api-key -- <siteId> "My label"
 */
import { PrismaClient } from "@prisma/client";

import { generatePublishingApiKey } from "@/lib/site-publishing-api";

const prisma = new PrismaClient();

async function main() {
  const siteIdArg = process.argv[2];
  const label = process.argv[3] ?? "WordPress plugin test key";

  const site = siteIdArg
    ? await prisma.siteProject.findUnique({ where: { id: siteIdArg } })
    : await prisma.siteProject.findFirst({ orderBy: { createdAt: "asc" } });

  if (!site) {
    throw new Error(
      siteIdArg
        ? `No SiteProject found with id ${siteIdArg}.`
        : "No SiteProject found. Run `npm run prisma:seed` first."
    );
  }

  const publishedCount = await prisma.article.count({
    where: { siteProjectId: site.id, status: "PUBLISHED" }
  });

  const { rawKey, keyHash, keyPrefix } = generatePublishingApiKey();

  await prisma.sitePublishingApiKey.create({
    data: { siteProjectId: site.id, label, keyHash, keyPrefix }
  });

  console.log("\n✅ Publishing API key created\n");
  console.log(`  Site name        : ${site.name ?? "(unnamed)"}`);
  console.log(`  Site ID          : ${site.id}`);
  console.log(`  Published articles: ${publishedCount}`);
  console.log(`  Label            : ${label}`);
  console.log("\n  Paste these into WP Admin → Settings → DIYSEO Sync:\n");
  console.log(`  Base URL : http://host.docker.internal:3000`);
  console.log(`  Site ID  : ${site.id}`);
  console.log(`  API key  : ${rawKey}`);
  console.log(
    "\n  (The raw key is shown only once — it is stored hashed. Re-run to mint another.)\n"
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
