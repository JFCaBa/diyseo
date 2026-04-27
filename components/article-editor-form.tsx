"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { updateArticle, type ActionState } from "@/lib/actions";
import { getCoverImageProxyPath } from "@/lib/cover-image-url";
import { getArticleEditorValue } from "@/lib/markdown";

type ArticleEditorFormProps = {
  article: {
    id: string;
    title: string;
    excerpt: string | null;
    coverImageUrl: string | null;
    contentHtml: string;
    contentMarkdown: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
  };
  siteId: string;
};

const initialState: ActionState = {};

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Saving..." : "Save Changes"}
    </button>
  );
}

export function ArticleEditorForm({ article, siteId }: ArticleEditorFormProps) {
  const updateArticleForSite = updateArticle.bind(null, siteId, article.id);
  const [state, formAction] = useActionState(updateArticleForSite, initialState);

  return (
    <form action={formAction} className="grid gap-6 rounded-3xl border border-line bg-white/90 p-6 shadow-panel">
      <div className="rounded-2xl border border-line bg-mist/70 px-4 py-4 text-sm text-slate-600">
        Update the article content and metadata here, then return to Articles to publish it, assign a keyword, or review it in the calendar.
      </div>

      <div className="grid gap-2">
        <label htmlFor="title" className="text-sm font-medium text-ink">
          Title
        </label>
        <input
          id="title"
          name="title"
          defaultValue={article.title}
          className="rounded-2xl border border-line px-4 py-3 outline-none transition focus:border-accent"
          required
        />
      </div>

      <div className="grid gap-2">
        <label htmlFor="excerpt" className="text-sm font-medium text-ink">
          Excerpt
        </label>
        <textarea
          id="excerpt"
          name="excerpt"
          defaultValue={article.excerpt ?? ""}
          rows={4}
          className="rounded-2xl border border-line px-4 py-3 outline-none transition focus:border-accent"
        />
      </div>

      <div className="grid gap-2">
        <label htmlFor="coverImageUrl" className="text-sm font-medium text-ink">
          Cover Image URL
        </label>
        <input
          id="coverImageUrl"
          name="coverImageUrl"
          type="url"
          defaultValue={article.coverImageUrl ?? ""}
          placeholder="https://example.com/cover.jpg"
          className="rounded-2xl border border-line px-4 py-3 outline-none transition focus:border-accent"
        />
        <p className="text-xs text-slate-500">Optional. Use a publicly reachable image URL.</p>
        {article.coverImageUrl ? (
          <img
            src={getCoverImageProxyPath(article.coverImageUrl)}
            alt=""
            referrerPolicy="no-referrer"
            className="mt-2 h-40 w-full rounded-2xl border border-line object-cover"
          />
        ) : null}
      </div>

      <div className="grid gap-2">
        <label htmlFor="seoTitle" className="text-sm font-medium text-ink">
          SEO Title
        </label>
        <input
          id="seoTitle"
          name="seoTitle"
          defaultValue={article.seoTitle ?? ""}
          maxLength={60}
          className="rounded-2xl border border-line px-4 py-3 outline-none transition focus:border-accent"
        />
        <p className="text-xs text-slate-500">Recommended max: 60 characters.</p>
      </div>

      <div className="grid gap-2">
        <label htmlFor="seoDescription" className="text-sm font-medium text-ink">
          SEO Description
        </label>
        <textarea
          id="seoDescription"
          name="seoDescription"
          defaultValue={article.seoDescription ?? ""}
          maxLength={160}
          rows={3}
          className="rounded-2xl border border-line px-4 py-3 outline-none transition focus:border-accent"
        />
        <p className="text-xs text-slate-500">Recommended max: 160 characters.</p>
      </div>

      <div className="grid gap-2">
        <label htmlFor="contentMarkdown" className="text-sm font-medium text-ink">
          Content Markdown
        </label>
        <textarea
          id="contentMarkdown"
          name="contentMarkdown"
          defaultValue={getArticleEditorValue(article.contentMarkdown, article.contentHtml)}
          rows={18}
          className="rounded-2xl border border-line px-4 py-3 font-mono text-sm outline-none transition focus:border-accent"
          required
        />
        <p className="text-xs text-slate-500">
          New and resaved articles use Markdown. Legacy HTML-only articles may show raw HTML here until they are resaved.
        </p>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-sm">
          {state.error ? <p className="text-red-600">{state.error}</p> : null}
          {state.success ? <p className="text-accent">{state.success}</p> : null}
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/${siteId}/articles`}
            className="inline-flex items-center justify-center rounded-2xl border border-line px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist"
          >
            Back to Articles
          </Link>
          <SaveButton />
        </div>
      </div>
    </form>
  );
}
