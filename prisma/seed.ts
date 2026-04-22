import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  let user = await prisma.user.findUnique({
    where: { email: "demo@diyseo.local" }
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: "demo@diyseo.local",
        name: "Demo User"
      }
    });
  }

  let workspace = await prisma.workspace.findUnique({
    where: { ownerId: user.id }
  });

  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        ownerId: user.id,
        name: "Default Workspace"
      }
    });
  }

  let site = await prisma.siteProject.findFirst({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "asc" }
  });

  if (!site) {
    site = await prisma.siteProject.create({
      data: {
        workspaceId: workspace.id,
        name: "Demo Site",
        domain: "https://demo.com"
      }
    });
  }

  const brandProfile = await prisma.brandProfile.findUnique({
    where: { siteProjectId: site.id }
  });

  if (!brandProfile) {
    await prisma.brandProfile.create({
      data: {
        siteProjectId: site.id
      }
    });
  }

  const existingArticles = await prisma.article.count({
    where: { siteProjectId: site.id }
  });

  if (existingArticles === 0) {
    await prisma.article.createMany({
      data: [
        {
          siteProjectId: site.id,
          title: "Welcome to DIYSEO",
          slug: "welcome-to-diyseo",
          excerpt: "An introduction to the demo content shipped with the self-hosted SEO workspace.",
          contentHtml:
            "<h1>Welcome to DIYSEO</h1><p>This demo article gives the existing site a small body of published content for Slice 2 API testing.</p><p>Use it to verify listing and article detail responses.</p>",
          status: "PUBLISHED",
          publishedAt: new Date("2026-04-20T09:00:00.000Z")
        },
        {
          siteProjectId: site.id,
          title: "How To Structure a Brand DNA Brief",
          slug: "how-to-structure-a-brand-dna-brief",
          excerpt: "A short example article covering how teams can capture consistent editorial context.",
          contentHtml:
            "<h1>How To Structure a Brand DNA Brief</h1><p>Brand guidance becomes more useful when it is clear, concise, and shared across every publishing workflow.</p><p>This article exists as seeded API content.</p>",
          status: "PUBLISHED",
          publishedAt: new Date("2026-04-21T09:00:00.000Z")
        },
        {
          siteProjectId: site.id,
          title: "Planning a Simple Editorial Calendar",
          slug: "planning-a-simple-editorial-calendar",
          excerpt: "A placeholder editorial article to support the public API detail endpoint.",
          contentHtml:
            "<h1>Planning a Simple Editorial Calendar</h1><p>Start with a small set of themes, match them to audience intent, and publish on a repeatable cadence.</p><p>Slice 2 exposes this article through the public API.</p>",
          status: "PUBLISHED",
          publishedAt: new Date("2026-04-22T09:00:00.000Z")
        }
      ]
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
