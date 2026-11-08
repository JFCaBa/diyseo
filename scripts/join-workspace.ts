/**
 * One-off: merge a team member's own workspace into the team's workspace.
 *
 * Usage:
 *   npx tsx scripts/join-workspace.ts --from <workspaceId> --into <workspaceId> [--apply]
 *
 * Without --apply it only prints what would move. DATABASE_URL comes from the
 * environment (or .env.local / .env), like the other scripts.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

for (const filename of [".env.local", ".env"]) {
  const filepath = resolve(process.cwd(), filename);
  if (!existsSync(filepath)) continue;
  for (const line of readFileSync(filepath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex < 1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const raw = trimmed.slice(eqIndex + 1).trim();
    const value = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
    if (!(key in process.env)) process.env[key] = value;
  }
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  const value = i >= 0 ? process.argv[i + 1] : undefined;
  return value && !value.startsWith("--") ? value : undefined;
}

async function main() {
  const from = arg("from");
  const into = arg("into");
  const apply = process.argv.includes("--apply");
  if (!from || !into) throw new Error("Usage: npx tsx scripts/join-workspace.ts --from <wid> --into <wid> [--apply]");

  const { prisma } = await import("@/lib/prisma");
  const { moveWorkspaceInto } = await import("@/lib/teams");
  const { effectivePlan } = await import("@/lib/entitlements");
  const { memberLimit } = await import("@/lib/satellite-entitlements");

  try {
    const source = await prisma.workspace.findUnique({
      where: { id: from },
      select: { owner: { select: { email: true } }, sites: { select: { name: true } }, _count: { select: { aiUsage: true } } }
    });
    const target = await prisma.workspace.findUnique({
      where: { id: into },
      select: { name: true, plan: true, trialEndsAt: true, _count: { select: { members: true } } }
    });
    if (!source) throw new Error(`Source workspace ${from} not found.`);
    if (!target) throw new Error(`Destination workspace ${into} not found.`);

    const now = new Date();
    const pending = await prisma.workspaceInvite.count({ where: { workspaceId: into, acceptedAt: null, expiresAt: { gt: now } } });
    const limit = memberLimit(effectivePlan(target, now));

    console.log(`Source owner: ${source.owner.email ?? "(no email)"}`);
    console.log(`Sites (${source.sites.length}): ${source.sites.map((s) => s.name).join(", ") || "-"}`);
    console.log(`AI usage rows: ${source._count.aiUsage}`);
    console.log(`Destination: ${target.name} (members ${target._count.members}, pending invites ${pending}, limit ${limit ?? "unlimited"})`);

    if (!apply) {
      console.log("Dry run. Pass --apply to move it.");
      return;
    }

    const result = await moveWorkspaceInto(from, into);
    console.log(`Done: moved ${result.sites} site(s); the owner is now a MEMBER of ${into}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
