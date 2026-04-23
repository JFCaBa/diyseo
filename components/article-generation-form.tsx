"use client";

import Link from "next/link";
import { useState } from "react";

import { SuggestedKeywords } from "@/components/suggested-keywords";

type ArticleGenerationFormProps = {
  siteId: string;
};

type GenerationResult = {
  article?: {
    id: string;
    title: string;
    slug: string;
    status: string;
  };
  keywords?: Array<{
    id: string;
    term: string;
  }>;
  error?: string;
};

export function ArticleGenerationForm({ siteId }: ArticleGenerationFormProps) {
  const [keyword, setKeyword] = useState("");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setResult(null);

    try {
      const response = await fetch(`/api/internal/sites/${siteId}/articles/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          keyword: keyword.trim() || undefined
        })
      });

      const payload = (await response.json()) as GenerationResult;

      if (!response.ok) {
        setResult({ error: payload.error || "Article generation failed." });
        return;
      }

      setResult(payload);
    } catch {
      setResult({ error: "Unable to reach the article generation endpoint." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 rounded-3xl border border-line bg-white/85 p-6 shadow-panel">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-ink">Generate a Draft</h2>
        <p className="text-sm text-slate-600">
          Uses the current Brand DNA plus an optional keyword to produce a saved draft article you can edit before publishing.
        </p>
      </div>

      <div className="grid gap-2">
        <label htmlFor="keyword" className="text-sm font-medium text-ink">
          Optional keyword
        </label>
        <input
          id="keyword"
          name="keyword"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="e.g. self-hosted SEO strategy"
          className="rounded-2xl border border-line px-4 py-3 outline-none transition focus:border-accent"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex w-fit items-center justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? "Generating..." : "Generate Draft Article"}
      </button>

      {result?.error ? <p className="text-sm text-red-600">{result.error}</p> : null}
      {result?.article ? (
        <div className="rounded-2xl border border-line bg-mist p-4 text-sm text-slate-700">
          <p className="font-semibold text-ink">{result.article.title}</p>
          <p>Slug: {result.article.slug}</p>
          <p>Status: {result.article.status}</p>
          <SuggestedKeywords articleId={result.article.id} siteId={siteId} keywords={result.keywords ?? []} />
          <Link
            href={`/${siteId}/articles/${result.article.id}`}
            className="mt-3 inline-flex text-sm font-semibold text-accent hover:underline"
          >
            Open in editor
          </Link>
        </div>
      ) : null}
    </form>
  );
}
