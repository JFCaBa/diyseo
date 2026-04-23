"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { createArticle, type ActionState } from "@/lib/actions";

type ArticleCreateFormProps = {
  initialValues: {
    contentHtml: string;
    coverImageUrl: string;
    excerpt: string;
    publishedDate: string;
    seoDescription: string;
    seoTitle: string;
    title: string;
  };
  returnTo: string;
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
      {pending ? "Creating..." : "Create Draft"}
    </button>
  );
}

export function ArticleCreateForm({ initialValues, returnTo, siteId }: ArticleCreateFormProps) {
  const createArticleForSite = createArticle.bind(null, siteId);
  const [state, formAction] = useActionState(createArticleForSite, initialState);

  return (
    <form action={formAction} className="grid gap-6 rounded-3xl border border-line bg-white/90 p-6 shadow-panel">
      <input type="hidden" name="returnTo" value={returnTo} />

      <div className="grid gap-2">
        <label htmlFor="publishedDate" className="text-sm font-medium text-ink">
          Scheduled Date
        </label>
        <input
          id="publishedDate"
          name="publishedDate"
          type="date"
          defaultValue={initialValues.publishedDate}
          className="rounded-2xl border border-line px-4 py-3 outline-none transition focus:border-accent"
        />
      </div>

      <div className="grid gap-2">
        <label htmlFor="title" className="text-sm font-medium text-ink">
          Title
        </label>
        <input
          id="title"
          name="title"
          defaultValue={initialValues.title}
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
          defaultValue={initialValues.excerpt}
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
          defaultValue={initialValues.coverImageUrl}
          placeholder="https://example.com/cover.jpg"
          className="rounded-2xl border border-line px-4 py-3 outline-none transition focus:border-accent"
        />
        <p className="text-xs text-slate-500">Optional. Use a publicly reachable image URL.</p>
      </div>

      <div className="grid gap-2">
        <label htmlFor="seoTitle" className="text-sm font-medium text-ink">
          SEO Title
        </label>
        <input
          id="seoTitle"
          name="seoTitle"
          defaultValue={initialValues.seoTitle}
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
          defaultValue={initialValues.seoDescription}
          maxLength={160}
          rows={3}
          className="rounded-2xl border border-line px-4 py-3 outline-none transition focus:border-accent"
        />
        <p className="text-xs text-slate-500">Recommended max: 160 characters.</p>
      </div>

      <div className="grid gap-2">
        <label htmlFor="contentHtml" className="text-sm font-medium text-ink">
          Content HTML
        </label>
        <textarea
          id="contentHtml"
          name="contentHtml"
          defaultValue={initialValues.contentHtml}
          rows={18}
          className="rounded-2xl border border-line px-4 py-3 font-mono text-sm outline-none transition focus:border-accent"
          required
        />
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-sm">
          {state.error ? <p className="text-red-600">{state.error}</p> : null}
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={returnTo}
            className="inline-flex items-center justify-center rounded-2xl border border-line px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist"
          >
            Back
          </Link>
          <SaveButton />
        </div>
      </div>
    </form>
  );
}
