import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { generateArticleForSite } from "@/lib/generate-article";
import { isQuotaError } from "@/lib/quota";
import { denyUnlessSiteOwner } from "@/lib/site-access";

type RouteContext = {
  params: Promise<{ siteId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { siteId } = await context.params;
    const denied = await denyUnlessSiteOwner(siteId);

    if (denied) {
      return denied;
    }

    const body = await request.json().catch(() => ({}));
    const result = await generateArticleForSite(siteId, body);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: error.issues[0]?.message ?? "Invalid request body."
        },
        { status: 400 }
      );
    }

    if (isQuotaError(error)) {
      return NextResponse.json({ error: error.message }, { status: 402 });
    }

    const message = error instanceof Error ? error.message : "Article generation failed.";
    const status =
      message === "Site not found."
        ? 404
        : message === "Brand profile is missing for this site."
          ? 400
          : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
