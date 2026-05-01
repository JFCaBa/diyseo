import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { generateArticleCoverImage } from "@/lib/ai/image-generator";
import { prisma } from "@/lib/prisma";
import { saveArticleCoverImageLocally } from "@/lib/storage/local";

type RouteContext = {
  params: Promise<{ siteId: string; articleId: string }>;
};

function normalizeTextValue(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function POST(request: Request, context: RouteContext) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { siteId, articleId } = await context.params;
  const formData = await request.formData();
  const titleOverride = normalizeTextValue(formData.get("title"));
  const excerptOverride = normalizeTextValue(formData.get("excerpt"));

  const article = await prisma.article.findFirst({
    where: {
      id: articleId,
      siteProjectId: siteId,
      siteProject: {
        workspace: {
          ownerId: session.user.id
        }
      }
    },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      status: true,
      siteProjectId: true,
      siteProject: {
        select: {
          id: true,
          name: true,
          domain: true,
          brandProfile: {
            select: {
              contentLanguage: true,
              businessType: true,
              brandVoiceTone: true,
              targetAudience: true,
              serviceArea: true,
              topicsToAvoid: true,
              keyThemes: true,
              customImageInstructions: true,
              imageStyle: true
            }
          }
        }
      }
    }
  });

  if (!article) {
    return NextResponse.json({ error: "Article not found." }, { status: 404 });
  }

  if (!article.siteProject.brandProfile) {
    return NextResponse.json({ error: "Brand profile is missing for this site." }, { status: 400 });
  }

  try {
    const image = await generateArticleCoverImage({
      article: {
        id: article.id,
        title: titleOverride || article.title,
        excerpt: excerptOverride ?? article.excerpt
      },
      site: {
        id: article.siteProject.id,
        name: article.siteProject.name,
        domain: article.siteProject.domain
      },
      brandProfile: article.siteProject.brandProfile
    });

    const saved = await saveArticleCoverImageLocally({
      siteId: article.siteProjectId,
      articleId: article.id,
      image
    });

    await prisma.article.update({
      where: {
        id: article.id
      },
      data: {
        coverImageUrl: saved.publicUrl
      }
    });

    revalidatePath(`/${siteId}/articles`);
    revalidatePath(`/${siteId}/articles/${article.id}`);
    revalidatePath(`/${siteId}/preview`);
    revalidatePath(`/blog/${siteId}`);
    revalidatePath(`/blog/${siteId}/${article.slug}`);
    revalidatePath(`/api/public/sites/${siteId}/articles`);
    revalidatePath(`/api/public/sites/${siteId}/articles/${article.slug}`);

    return NextResponse.json({
      coverImageUrl: saved.publicUrl
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cover image generation failed.";
    const status =
      message === "QWEN_API_KEY is not configured." || message === "Brand profile is missing for this site."
        ? 400
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
