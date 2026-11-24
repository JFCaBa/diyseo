"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { ArticleStatus, SocialNetwork } from "@prisma/client";

import { useLocalizeMessage, useT } from "@/components/i18n-provider";
import {
  generateSocialPostsAction,
  markSocialPostPostedAction,
  publishSocialPostAction,
  resolveUnknownAction,
  saveSocialPostAction,
  type SocialActionResult
} from "@/lib/social-actions";
import { SOCIAL_LIMITS, SOCIAL_NETWORKS } from "@/lib/social/limits";
import { localizeBlocker, localizeStoredPostError } from "@/lib/social/localize";
import { publishBlockerFor, shareBlockerFor, textBlockerFor, type EffectiveStatus } from "@/lib/social/rules";
import { linkedinIntentUrl, withLink, xIntentUrl } from "@/lib/social/urls";

export type SocialPostView = {
  id: string;
  network: SocialNetwork;
  text: string;
  status: EffectiveStatus;
  error: string | null;
  externalUrl: string | null;
};

type Props = {
  siteId: string;
  articleId: string;
  articleStatus: ArticleStatus;
  shareUrl: string;
  hasLocalCover: boolean;
  connection: { pageName: string; instagramUsername: string | null; hasInstagram: boolean } | null;
  posts: SocialPostView[];
};

const LABEL: Record<SocialNetwork, string> = { FACEBOOK: "Facebook", INSTAGRAM: "Instagram", X: "X", LINKEDIN: "LinkedIn" };

const btn = "inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
const primary = `${btn} bg-ink text-white hover:bg-slate-800`;
const secondary = `${btn} border border-line bg-white text-ink hover:bg-mist`;

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

function StatusBadge({ status }: { status: EffectiveStatus }) {
  const styles: Record<EffectiveStatus, string> = {
    DRAFT: "bg-mist text-slate-600",
    PUBLISHING: "bg-amber-50 text-amber-700",
    PUBLISHED: "bg-emerald-50 text-emerald-700",
    FAILED: "bg-red-50 text-red-700",
    UNKNOWN: "bg-amber-50 text-amber-800"
  };
  const t = useT();
  const text: Record<EffectiveStatus, string> = {
    DRAFT: t("social.status.DRAFT"),
    PUBLISHING: t("social.status.PUBLISHING"),
    PUBLISHED: t("social.status.PUBLISHED"),
    FAILED: t("social.status.FAILED"),
    UNKNOWN: t("social.status.UNKNOWN")
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[status]}`}>{text[status]}</span>;
}

function PostCard({ props, post }: { props: Props; post: SocialPostView }) {
  const t = useT();
  const localizeMessage = useLocalizeMessage();
  const [text, setText] = useState(post.text);
  // A save or regeneration brings new text from the server: show it (the card keeps its state, e.g. "Saved").
  useEffect(() => setText(post.text), [post.text]);
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<null | "publish" | "retry" | "regenerate">(null);
  const [pending, startTransition] = useTransition();
  const limit = SOCIAL_LIMITS[post.network];
  const editable = post.status === "DRAFT" || post.status === "FAILED";
  const dirty = text !== post.text;
  const over = text.trim().length > limit;
  const isApi = post.network === "FACEBOOK" || post.network === "INSTAGRAM";

  const run = (action: (fd: FormData) => Promise<SocialActionResult>, values: Record<string, string>, done?: string) =>
    startTransition(async () => {
      setConfirming(null);
      const result = await action(form({ siteId: props.siteId, ...values }));
      setMessage(result.ok ? (done ?? null) : localizeMessage(result.error));
    });

  const sharingBlocker = !isApi ? shareBlockerFor({ network: post.network, text, articleStatus: props.articleStatus }) : null;
  const sharing = sharingBlocker ? localizeBlocker(t, sharingBlocker) : null;
  const publishBlock = isApi
    ? dirty
      ? null
      : publishBlockerFor({
          network: post.network,
          text,
          status: post.status === "UNKNOWN" ? "PUBLISHING" : post.status,
          articleStatus: props.articleStatus,
          hasConnection: Boolean(props.connection),
          hasInstagram: Boolean(props.connection?.hasInstagram),
          hasCover: props.hasLocalCover
        })
    : null;
  const blocker = isApi ? (dirty ? t("social.blocker.saveFirst") : publishBlock ? localizeBlocker(t, publishBlock) : null) : null;
  const target =
    post.network === "FACEBOOK"
      ? t("social.facebookTarget", { name: props.connection?.pageName ?? "" })
      : t("social.instagramTarget", { username: props.connection?.instagramUsername ?? "" });

  return (
    <article className="flex flex-col gap-3 rounded-3xl border border-line bg-white p-5">
      <header className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-ink">{LABEL[post.network]}</h3>
        <StatusBadge status={post.status} />
      </header>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        readOnly={!editable}
        rows={post.network === "X" ? 4 : 9}
        className="w-full rounded-2xl border border-line px-4 py-3 text-sm text-ink read-only:bg-mist"
      />
      <div className="flex items-center justify-between text-xs">
        <span className={over ? "font-semibold text-red-600" : "text-slate-500"}>
          {text.trim().length} / {limit}
        </span>
        {editable && dirty ? (
          <button
            type="button"
            className={secondary}
            disabled={pending}
            onClick={() => run(saveSocialPostAction, { postId: post.id, text }, t("social.saved"))}
          >
            {t("social.save")}
          </button>
        ) : null}
      </div>

      {post.error && post.status !== "PUBLISHED" && post.status !== "DRAFT" ? <p className="text-xs text-red-600">{localizeStoredPostError(t, localizeMessage, post.error)}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        {post.status === "PUBLISHED" && post.externalUrl ? (
          <a href={post.externalUrl} target="_blank" rel="noreferrer" className={secondary}>
            {t("social.viewPost")}
          </a>
        ) : null}

        {isApi && editable ? (
          confirming === "publish" ? (
            <>
              <span className="text-sm text-ink">{t("social.publishTo", { target })}</span>
              <button type="button" className={primary} disabled={pending} onClick={() => run(publishSocialPostAction, { postId: post.id }, t("social.published"))}>
                {pending ? t("social.publishing") : t("social.yesPublish")}
              </button>
              <button type="button" className={secondary} onClick={() => setConfirming(null)}>
                {t("social.cancel")}
              </button>
            </>
          ) : (
            <button type="button" className={primary} disabled={pending || Boolean(blocker)} title={blocker ?? undefined} onClick={() => setConfirming("publish")}>
              {t("social.publish")}
            </button>
          )
        ) : null}

        {!isApi && editable ? (
          <>
            {sharing ? (
              <button type="button" className={primary} disabled title={sharing}>
                {t("social.openIn", { network: LABEL[post.network] })}
              </button>
            ) : (
              <a
                href={post.network === "X" ? xIntentUrl(text, props.shareUrl) : linkedinIntentUrl(text, props.shareUrl)}
                target="_blank"
                rel="noreferrer"
                className={primary}
              >
                {t("social.openIn", { network: LABEL[post.network] })}
              </a>
            )}
            <button type="button" className={secondary} disabled={Boolean(sharing)} onClick={() => navigator.clipboard?.writeText(withLink(text, props.shareUrl)).then(() => setMessage(t("social.copied")))}>
              {t("social.copy")}
            </button>
            <button type="button" className={secondary} disabled={pending || dirty || Boolean(sharing)} onClick={() => run(markSocialPostPostedAction, { postId: post.id }, t("social.markedPosted"))}>
              {t("social.markPosted")}
            </button>
          </>
        ) : null}

        {post.status === "UNKNOWN" ? (
          confirming === "retry" ? (
            <>
              <span className="text-sm text-ink">{t("social.retryNote")}</span>
              <button type="button" className={primary} disabled={pending} onClick={() => run(resolveUnknownAction, { postId: post.id, outcome: "retry" })}>
                {t("social.notThereAllowRetry")}
              </button>
              <button type="button" className={secondary} onClick={() => setConfirming(null)}>
                {t("social.cancel")}
              </button>
            </>
          ) : (
            <>
              <span className="text-sm text-amber-800">{t("social.unknownCheck")}</span>
              <button type="button" className={secondary} disabled={pending} onClick={() => run(resolveUnknownAction, { postId: post.id, outcome: "published" })}>
                {t("social.onThePage")}
              </button>
              <button type="button" className={secondary} onClick={() => setConfirming("retry")}>
                {t("social.notThereRetry")}
              </button>
            </>
          )
        ) : null}

        {editable ? (
          confirming === "regenerate" ? (
            <>
              <span className="text-sm text-ink">{t("social.replaceDraft")}</span>
              <button
                type="button"
                className={secondary}
                disabled={pending}
                onClick={() => run(generateSocialPostsAction, { articleId: props.articleId, network: post.network })}
              >
                {t("social.yesRegenerate")}
              </button>
            </>
          ) : (
            <button type="button" className={secondary} disabled={pending} onClick={() => setConfirming("regenerate")}>
              {t("social.regenerate")}
            </button>
          )
        ) : null}
      </div>

      {(blocker ?? sharing) && editable && !textBlockerFor(post.network, text) ? <p className="text-xs text-slate-500">{blocker ?? sharing}</p> : null}
      {message ? <p className="text-xs text-slate-600">{message}</p> : null}
    </article>
  );
}

export function SocialPostsPanel(props: Props) {
  const t = useT();
  const localizeMessage = useLocalizeMessage();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const anyPublishing = props.posts.some((p) => p.status === "PUBLISHING");
  // While a publish has not reported back, refresh now and then: the card turns into "Unknown result" by itself.
  useEffect(() => {
    if (!anyPublishing) return;
    const timer = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(timer);
  }, [anyPublishing, router]);
  const [error, setError] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const byNetwork = new Map(props.posts.map((p) => [p.network, p]));
  const hasPosts = props.posts.length > 0;
  const anyUnpublished = SOCIAL_NETWORKS.some((n) => {
    const s = byNetwork.get(n)?.status;
    return !s || s === "DRAFT" || s === "FAILED";
  });

  const generate = () =>
    startTransition(async () => {
      setConfirmAll(false);
      const result = await generateSocialPostsAction(form({ siteId: props.siteId, articleId: props.articleId }));
      setError(result.ok ? null : localizeMessage(result.error));
    });

  return (
    <section className="rounded-3xl border border-line bg-white/90 p-6 shadow-panel">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">{t("social.eyebrow")}</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">{t("social.title")}</h2>
          <p className="mt-2 text-sm text-slate-600">
            {t("social.description")}
          </p>
          {props.articleStatus !== "PUBLISHED" ? <p className="mt-2 text-sm text-amber-700">{t("social.publishArticleNote")}</p> : null}
          {!props.connection ? (
            <p className="mt-2 text-sm text-slate-600">
              {t("social.noPage")}{" "}
              <a href={`/${props.siteId}/settings#social`} className="font-semibold text-accent">
                {t("social.connectInSettings")}
              </a>
              .
            </p>
          ) : null}
        </div>
        {!hasPosts ? (
          <button type="button" className={primary} disabled={pending} onClick={generate}>
            {pending ? t("social.writing") : t("social.generate")}
          </button>
        ) : anyUnpublished ? (
          confirmAll ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-ink">{t("social.replacesDrafts")}</span>
              <button type="button" className={primary} disabled={pending} onClick={generate}>
                {pending ? t("social.writing") : t("social.regenerateAll")}
              </button>
              <button type="button" className={secondary} onClick={() => setConfirmAll(false)}>
                {t("social.cancel")}
              </button>
            </div>
          ) : (
            <button type="button" className={secondary} disabled={pending} onClick={() => setConfirmAll(true)}>
              {t("social.regenerateAll")}
            </button>
          )
        ) : null}
      </div>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {hasPosts ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {SOCIAL_NETWORKS.map((n) => {
            const post = byNetwork.get(n);
            return post ? <PostCard key={post.id} props={props} post={post} /> : null;
          })}
        </div>
      ) : null}
    </section>
  );
}
