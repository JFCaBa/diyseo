import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { prisma } from "@/lib/prisma";
import { GetSiteConfigSchema } from "@/lib/validations";

type RouteContext = {
  params: Promise<{ siteId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const parsedParams = GetSiteConfigSchema.parse(await context.params);
    const site = await prisma.siteProject.findUnique({
      where: { id: parsedParams.siteId },
      select: {
        name: true,
        brandProfile: {
          select: {
            contentLanguage: true,
            imageStyle: true
          }
        }
      }
    });

    if (!site) {
      return NextResponse.json({ error: "Site not found." }, { status: 404 });
    }

    const url = new URL(request.url);

    return NextResponse.json({
      siteName: site.name,
      contentLanguage: site.brandProfile?.contentLanguage ?? "en",
      imageStyle: site.brandProfile?.imageStyle ?? null,
      basePath: url.origin
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: error.issues[0]?.message ?? "Invalid site id."
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Unable to load site config." }, { status: 500 });
  }
}
