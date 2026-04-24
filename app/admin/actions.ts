"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  ADMIN_COOKIE_MAX_AGE,
  ADMIN_COOKIE_NAME,
  buildAdminSessionValue,
  getConfiguredAdminPassword,
  requireAdminAuth
} from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export type AdminAuthState = {
  error?: string;
};

const ADMIN_LOGIN_WINDOW_MS = 10 * 60 * 1000;
const ADMIN_LOGIN_MAX_ATTEMPTS = 5;
const adminLoginAttempts = new Map<string, { count: number; firstAttemptAt: number }>();

function getAdminRateLimitKey(headerList: Headers) {
  const forwardedFor = headerList.get("x-forwarded-for");
  const realIp = headerList.get("x-real-ip");
  const ip = forwardedFor?.split(",")[0]?.trim() || realIp?.trim();

  return ip ? `ip:${ip}` : "ip:unknown";
}

function getActiveAttemptRecord(key: string) {
  const now = Date.now();
  const existing = adminLoginAttempts.get(key);

  if (!existing) {
    return null;
  }

  if (now - existing.firstAttemptAt >= ADMIN_LOGIN_WINDOW_MS) {
    adminLoginAttempts.delete(key);
    return null;
  }

  return existing;
}

function isAdminRateLimited(key: string) {
  const attemptRecord = getActiveAttemptRecord(key);

  if (!attemptRecord) {
    return false;
  }

  return attemptRecord.count >= ADMIN_LOGIN_MAX_ATTEMPTS;
}

function recordFailedAdminAttempt(key: string) {
  const now = Date.now();
  const attemptRecord = getActiveAttemptRecord(key);

  if (!attemptRecord) {
    adminLoginAttempts.set(key, {
      count: 1,
      firstAttemptAt: now
    });
    return;
  }

  adminLoginAttempts.set(key, {
    count: attemptRecord.count + 1,
    firstAttemptAt: attemptRecord.firstAttemptAt
  });
}

function clearFailedAdminAttempts(key: string) {
  adminLoginAttempts.delete(key);
}

export async function signInToAdmin(
  _prevState: AdminAuthState,
  formData: FormData
): Promise<AdminAuthState> {
  const configuredPassword = getConfiguredAdminPassword();

  if (!configuredPassword) {
    return { error: "ADMIN_PASSWORD is not configured." };
  }

  const headerList = await headers();
  const rateLimitKey = getAdminRateLimitKey(headerList);

  if (isAdminRateLimited(rateLimitKey)) {
    return { error: "Too many attempts. Try again later." };
  }

  const submittedPassword = typeof formData.get("password") === "string" ? formData.get("password")!.toString() : "";

  if (!submittedPassword || buildAdminSessionValue(submittedPassword) !== buildAdminSessionValue(configuredPassword)) {
    recordFailedAdminAttempt(rateLimitKey);
    return { error: "Incorrect admin password." };
  }

  clearFailedAdminAttempts(rateLimitKey);

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, buildAdminSessionValue(configuredPassword), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: ADMIN_COOKIE_MAX_AGE
  });

  redirect("/admin");
}

export type AdminArticleToggleState = {
  error?: string;
  success?: string;
};

export async function adminToggleArticleStatus(
  _prevState: AdminArticleToggleState,
  formData: FormData
): Promise<AdminArticleToggleState> {
  await requireAdminAuth();

  const articleId = formData.get("articleId")?.toString().trim();
  const nextStatus = formData.get("status")?.toString().trim();

  if (!articleId || (nextStatus !== "PUBLISHED" && nextStatus !== "DRAFT")) {
    return { error: "Invalid request." };
  }

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { id: true, slug: true, siteProjectId: true }
  });

  if (!article) {
    return { error: "Article not found." };
  }

  await prisma.article.update({
    where: { id: article.id },
    data: nextStatus === "PUBLISHED"
      ? { status: "PUBLISHED", publishedAt: new Date() }
      : { status: "DRAFT", publishedAt: null }
  });

  revalidatePath("/admin/content");
  revalidatePath(`/api/public/sites/${article.siteProjectId}/articles`);
  revalidatePath(`/api/public/sites/${article.siteProjectId}/articles/${article.slug}`);

  return { success: nextStatus === "PUBLISHED" ? "Published." : "Unpublished." };
}

export async function signOutFromAdmin() {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: 0
  });

  redirect("/admin");
}
