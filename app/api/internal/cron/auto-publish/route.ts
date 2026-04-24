import { NextResponse } from "next/server";

import { runAutoPublishScheduler } from "@/lib/auto-publish";

function authorizeCronRequest(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) {
    return { ok: false as const, status: 500, error: "CRON_SECRET is not configured." };
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return { ok: false as const, status: 401, error: "Unauthorized." };
  }

  return { ok: true as const };
}

export async function POST(request: Request) {
  const authorization = authorizeCronRequest(request);

  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  }

  try {
    const result = await runAutoPublishScheduler();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Auto-publish cron failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
