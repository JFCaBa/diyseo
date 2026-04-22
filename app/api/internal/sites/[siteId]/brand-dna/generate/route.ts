import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { generateBrandDNAForSite } from "@/lib/generate-brand-dna";

type RouteContext = {
  params: Promise<{ siteId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { siteId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const brandDNA = await generateBrandDNAForSite(siteId, body);

    return NextResponse.json({ brandDNA }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: error.issues[0]?.message ?? "Invalid request body."
        },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : "Brand DNA generation failed.";
    const status = message === "Site not found." ? 404 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
