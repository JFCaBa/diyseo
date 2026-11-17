"use server";

import { randomUUID } from "node:crypto";

import { Prisma, type SocialNetwork, type SocialPostStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { getAIGenerationService } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import { createFixedWindowLimiter } from "@/lib/rate-limit";
import { claimSocialPost, finishAttempt, resolveUnknown } from "@/lib/social/claim";
import { SocialConfigError, decryptToken, encryptToken, tokenLast4 } from "@/lib/social/crypto";
import { articleText, mergeDrafts } from "@/lib/social/drafts";
import { saveConnection } from "@/lib/social/connection";
import { MetaGraphError, defaultGraphDeps, publishFacebook, publishInstagram, verifyPage } from "@/lib/social/meta-graph";
import { effectiveStatus, publishBlocker, shareBlocker, textBlocker } from "@/lib/social/rules";
import { isLocalCover } from "@/lib/social/social-image";
import { articleShareUrl, coverVersion, socialImageUrl } from "@/lib/social/urls";
import {
  ConnectMetaSchema,
  GenerateSocialPostsSchema,
  ResolveUnknownSchema,
  SaveSocialPostSchema,
  SiteIdSchema,
  SocialPostIdSchema
} from "@/lib/validations";
import { requireOwner, requireWorkspace } from "@/lib/workspace-context";
import { findSiteInWorkspace } from "@/lib/workspace-guards";

export type SocialActionResult = { ok: true } | { ok: false; error: string };

const NOT_FOUND = "Not found.";
const OWNER_ONLY = "Only the workspace owner can manage social accounts.";
const RETRY = "Something went wrong, please try again.";
const NOT_CONFIGURED = "Social publishing is not configured on this server (SOCIAL_TOKEN_KEY).";

const generationAllowed = createFixedWindowLimiter({ limit: 10, windowMs: 60 * 60_000 });

const fail = (error: string): SocialActionResult => ({ ok: false, error });

async function memberOrNull() {
  return requireWorkspace().catch((error: unknown) => {
    if (error instanceof Error && error.message === "Unauthorized") return null;
    throw error;
  });
}

async function ownerOrNull() {
  return requireOwner().catch((error: unknown) => {
    if (error instanceof Error && (error.message === "Unauthorized" || error.message === "Forbidden")) return null;
    throw error;
  });
}

function fields(formData: FormData) {
  return Object.fromEntries(Array.from(formData.entries()).filter(([, v]) => typeof v === "string"));
}

function revalidateSocial(siteId: string, articleId?: string) {
  if (articleId) revalidatePath(`/${siteId}/articles/${articleId}`);
  revalidatePath(`/${siteId}/settings`);
}

export async function connectMetaAction(formData: FormData): Promise<SocialActionResult> {
  const owner = await ownerOrNull();
  if (!owner) return fail(OWNER_ONLY);
  const parsed = ConnectMetaSchema.safeParse(fields(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the Page ID and token.");
  const { siteId, pageId, accessToken } = parsed.data;
  if (!(await findSiteInWorkspace(siteId, owner.workspaceId))) return fail(NOT_FOUND);

  let page: Awaited<ReturnType<typeof verifyPage>>;
  try {
    page = await verifyPage(accessToken, pageId, defaultGraphDeps());
  } catch (error) {
    return fail(error instanceof MetaGraphError ? `Meta: ${error.message}` : RETRY);
  }

  let accessTokenEncrypted: string;
  try {
    accessTokenEncrypted = encryptToken(page.pageToken);
  } catch (error) {
    return fail(error instanceof SocialConfigError ? NOT_CONFIGURED : RETRY);
  }

  const data = {
    pageId,
    pageName: page.pageName,
    instagramAccountId: page.instagramAccountId,
    instagramUsername: page.instagramUsername,
    accessTokenEncrypted,
    // The owner recognises the token they pasted; the stored one may be the Page token derived from it.
    tokenLast4: tokenLast4(accessToken),
    connectedByUserId: owner.userId
  };
  if (!(await saveConnection(prisma, siteId, owner.workspaceId, data))) return fail(NOT_FOUND);
  revalidateSocial(siteId);
  return { ok: true };
}

export async function testMetaConnectionAction(formData: FormData): Promise<SocialActionResult> {
  const owner = await ownerOrNull();
  if (!owner) return fail(OWNER_ONLY);
  const parsed = SiteIdSchema.safeParse(fields(formData));
  if (!parsed.success) return fail(NOT_FOUND);
  const { siteId } = parsed.data;
  if (!(await findSiteInWorkspace(siteId, owner.workspaceId))) return fail(NOT_FOUND);
  const connection = await prisma.siteSocialConnection.findUnique({ where: { siteProjectId: siteId } });
  if (!connection) return fail("No Facebook Page is connected.");

  try {
    const token = decryptToken(connection.accessTokenEncrypted);
    const page = await verifyPage(token, connection.pageId, defaultGraphDeps());
    await prisma.siteSocialConnection.update({
      where: { siteProjectId: siteId },
      data: { pageName: page.pageName, instagramAccountId: page.instagramAccountId, instagramUsername: page.instagramUsername }
    });
  } catch (error) {
    if (error instanceof SocialConfigError) return fail(NOT_CONFIGURED);
    return fail(error instanceof MetaGraphError ? `Meta: ${error.message}` : RETRY);
  }
  revalidateSocial(siteId);
  return { ok: true };
}

export async function disconnectMetaAction(formData: FormData): Promise<SocialActionResult> {
  const owner = await ownerOrNull();
  if (!owner) return fail(OWNER_ONLY);
  const parsed = SiteIdSchema.safeParse(fields(formData));
  if (!parsed.success) return fail(NOT_FOUND);
  const { siteId } = parsed.data;
  if (!(await findSiteInWorkspace(siteId, owner.workspaceId))) return fail(NOT_FOUND);
  await prisma.siteSocialConnection.deleteMany({ where: { siteProjectId: siteId } });
  revalidateSocial(siteId);
  return { ok: true };
}

export async function generateSocialPostsAction(formData: FormData): Promise<SocialActionResult> {
  const member = await memberOrNull();
  if (!member) return fail(NOT_FOUND);
  const parsed = GenerateSocialPostsSchema.safeParse(fields(formData));
  if (!parsed.success) return fail(NOT_FOUND);
  const { siteId, articleId, network } = parsed.data;
  if (!(await findSiteInWorkspace(siteId, member.workspaceId))) return fail(NOT_FOUND);

  const article = await prisma.article.findFirst({
    where: { id: articleId, siteProjectId: siteId },
    select: {
      title: true,
      excerpt: true,
      slug: true,
      contentMarkdown: true,
      contentHtml: true,
      siteProject: { select: { id: true, name: true, domain: true, proxyVerifiedAt: true, brandProfile: true } },
      socialPosts: { select: { network: true, status: true } }
    }
  });
  if (!article) return fail(NOT_FOUND);
  if (!generationAllowed(member.workspaceId)) return fail("Too many generations, try again in an hour");

  const site = article.siteProject;
  let generated;
  try {
    generated = await getAIGenerationService().generateSocialPosts({
      article: { title: article.title, excerpt: article.excerpt, markdown: articleText(article.contentMarkdown, article.contentHtml) },
      articleUrl: articleShareUrl(site, article.slug),
      site: { name: site.name, domain: site.domain },
      brandProfile: site.brandProfile ?? {}
    });
  } catch (error) {
    console.error("social_generation_failed", { message: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    return fail("The AI could not write the posts, please try again.");
  }

  const drafts = mergeDrafts(article.socialPosts, generated).filter((d) => !network || d.network === network);
  for (const draft of drafts) {
    const { count } = await prisma.socialPost.updateMany({
      where: { articleId, siteProjectId: siteId, network: draft.network, status: { in: ["DRAFT", "FAILED"] } },
      data: { text: draft.text, status: "DRAFT", error: null }
    });
    if (count > 0) continue;
    try {
      await prisma.socialPost.create({ data: { articleId, siteProjectId: siteId, network: draft.network, text: draft.text } });
    } catch (error) {
      // A row appeared meanwhile (a concurrent generation, or one now being published): leave it as it is.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
    }
  }
  revalidateSocial(siteId, articleId);
  return { ok: true };
}

export async function saveSocialPostAction(formData: FormData): Promise<SocialActionResult> {
  const member = await memberOrNull();
  if (!member) return fail(NOT_FOUND);
  const parsed = SaveSocialPostSchema.safeParse(fields(formData));
  if (!parsed.success) return fail("Text is too long.");
  const { siteId, postId, text } = parsed.data;
  if (!(await findSiteInWorkspace(siteId, member.workspaceId))) return fail(NOT_FOUND);

  const post = await prisma.socialPost.findFirst({ where: { id: postId, siteProjectId: siteId }, select: { network: true, articleId: true } });
  if (!post) return fail(NOT_FOUND);
  const blocked = textBlocker(post.network, text);
  if (blocked) return fail(blocked);

  const { count } = await prisma.socialPost.updateMany({
    where: { id: postId, siteProjectId: siteId, status: { in: ["DRAFT", "FAILED"] } },
    data: { text: text.trim(), status: "DRAFT", error: null }
  });
  if (count === 0) return fail("This post can no longer be edited");
  revalidateSocial(siteId, post.articleId);
  return { ok: true };
}

export async function publishSocialPostAction(formData: FormData): Promise<SocialActionResult> {
  const member = await memberOrNull();
  if (!member) return fail(NOT_FOUND);
  const parsed = SocialPostIdSchema.safeParse(fields(formData));
  if (!parsed.success) return fail(NOT_FOUND);
  const { siteId, postId } = parsed.data;
  if (!(await findSiteInWorkspace(siteId, member.workspaceId))) return fail(NOT_FOUND);

  const before = await prisma.socialPost.findFirst({ where: { id: postId, siteProjectId: siteId }, select: { status: true, network: true } });
  if (!before) return fail(NOT_FOUND);
  if (before.network === "X" || before.network === "LINKEDIN") return fail("Open the network to post");

  const attemptId = randomUUID();
  if (!(await claimSocialPost(prisma, { postId, siteProjectId: siteId, attemptId }))) {
    const now = await prisma.socialPost.findFirst({ where: { id: postId, siteProjectId: siteId }, select: { status: true } });
    return fail(now?.status === "PUBLISHED" ? "Already published" : "Publishing in progress");
  }
  const previous: SocialPostStatus = before.status === "FAILED" ? "FAILED" : "DRAFT";
  const mine = { postId, siteProjectId: siteId, attemptId };
  const release = () => finishAttempt(prisma, mine, { status: previous, attemptId: null });

  // After the claim the text is frozen (saves only touch DRAFT/FAILED), so what is checked is what gets posted.
  const post = await prisma.socialPost.findFirst({
    where: { id: postId, siteProjectId: siteId },
    select: {
      network: true,
      text: true,
      article: { select: { id: true, slug: true, status: true, coverImageUrl: true } },
      siteProject: { select: { id: true, domain: true, proxyVerifiedAt: true, socialConnection: true } }
    }
  });
  if (!post) return fail(NOT_FOUND);
  const connection = post.siteProject.socialConnection;
  const cover = post.article.coverImageUrl;
  const blocked = publishBlocker({
    network: post.network,
    text: post.text,
    status: previous,
    articleStatus: post.article.status,
    hasConnection: Boolean(connection),
    hasInstagram: Boolean(connection?.instagramAccountId),
    hasCover: isLocalCover(cover)
  });
  if (blocked || !connection) {
    await release();
    return fail(blocked ?? "Connect a Facebook Page in site settings");
  }

  let token: string;
  try {
    token = decryptToken(connection.accessTokenEncrypted);
  } catch (error) {
    await release();
    return fail(error instanceof SocialConfigError ? NOT_CONFIGURED : "The saved Meta token cannot be read: connect the Page again.");
  }

  const link = articleShareUrl(post.siteProject, post.article.slug);
  const imageUrl = isLocalCover(cover) ? socialImageUrl(siteId, post.article.id, coverVersion(cover)) : null;
  if (post.network === "INSTAGRAM" && !imageUrl) {
    await release();
    return fail("The app URL is not configured (NEXT_PUBLIC_APP_URL must be an absolute URL), so Meta cannot fetch the image.");
  }
  const deps = defaultGraphDeps();
  // Right before the publishing request: still ours? (also refreshes the clock that would show it as UNKNOWN)
  const opts = { beforePublish: () => finishAttempt(prisma, mine, { updatedAt: new Date() }) };
  try {
    const result =
      post.network === "FACEBOOK"
        ? await publishFacebook(token, connection.pageId, { text: post.text, imageUrl, link }, deps, opts)
        : await publishInstagram(token, connection.instagramAccountId!, { text: post.text, imageUrl: imageUrl! }, deps, opts);
    const recorded = await finishAttempt(prisma, mine, {
      status: "PUBLISHED",
      externalId: result.id,
      externalUrl: result.url,
      publishedAt: new Date(),
      error: null
    });
    if (!recorded) console.error("social_publish_result_not_recorded", { postId, network: post.network });
    revalidateSocial(siteId, post.article.id);
    return { ok: true };
  } catch (error) {
    const message = error instanceof MetaGraphError ? error.message : "Unexpected error while publishing";
    if (error instanceof MetaGraphError && error.definite) {
      await finishAttempt(prisma, mine, { status: "FAILED", error: message });
      revalidateSocial(siteId, post.article.id);
      return fail(`Meta: ${message}`);
    }
    // The publishing call may have gone through: stay PUBLISHING so it is never posted twice by a blind retry.
    await finishAttempt(prisma, mine, { error: `Unknown result: ${message}` });
    revalidateSocial(siteId, post.article.id);
    return fail("Meta did not confirm the post. Check the Page before trying again.");
  }
}

export async function markSocialPostPostedAction(formData: FormData): Promise<SocialActionResult> {
  const member = await memberOrNull();
  if (!member) return fail(NOT_FOUND);
  const parsed = SocialPostIdSchema.safeParse(fields(formData));
  if (!parsed.success) return fail(NOT_FOUND);
  const { siteId, postId } = parsed.data;
  if (!(await findSiteInWorkspace(siteId, member.workspaceId))) return fail(NOT_FOUND);

  const post = await prisma.socialPost.findFirst({
    where: { id: postId, siteProjectId: siteId },
    select: { network: true, text: true, articleId: true, article: { select: { status: true } } }
  });
  if (!post || (post.network !== "X" && post.network !== "LINKEDIN")) return fail(NOT_FOUND);
  const blocked = shareBlocker({ network: post.network, text: post.text, articleStatus: post.article.status });
  if (blocked) return fail(blocked);

  const networks: SocialNetwork[] = ["X", "LINKEDIN"];
  const { count } = await prisma.socialPost.updateMany({
    where: { id: postId, siteProjectId: siteId, network: { in: networks }, status: { in: ["DRAFT", "FAILED"] } },
    data: { status: "PUBLISHED", publishedAt: new Date(), error: null }
  });
  if (count === 0) return fail("This post can no longer be changed");
  revalidateSocial(siteId, post.articleId);
  return { ok: true };
}

export async function resolveUnknownAction(formData: FormData): Promise<SocialActionResult> {
  const member = await memberOrNull();
  if (!member) return fail(NOT_FOUND);
  const parsed = ResolveUnknownSchema.safeParse(fields(formData));
  if (!parsed.success) return fail(NOT_FOUND);
  const { siteId, postId, outcome } = parsed.data;
  if (!(await findSiteInWorkspace(siteId, member.workspaceId))) return fail(NOT_FOUND);

  const post = await prisma.socialPost.findFirst({
    where: { id: postId, siteProjectId: siteId },
    select: { status: true, updatedAt: true, attemptId: true, articleId: true }
  });
  if (!post || effectiveStatus(post, new Date()) !== "UNKNOWN") return fail("This post is not waiting for a check");

  const resolved = await resolveUnknown(prisma, { postId, siteProjectId: siteId, attemptId: post.attemptId }, outcome, new Date());
  if (!resolved) return fail("This post changed meanwhile, reload the page");
  revalidateSocial(siteId, post.articleId);
  return { ok: true };
}
