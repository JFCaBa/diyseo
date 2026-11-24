"use client";

import Link from "next/link";
import { useState } from "react";

import { useLocalizeMessage, useT } from "@/components/i18n-provider";
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
  const t = useT();
  const localizeMessage = useLocalizeMessage();
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
        setResult({ error: payload.error || t("articles.generate.failed") });
        return;
      }

      setResult(payload);
    } catch {
      setResult({ error: t("articles.generate.unreachable") });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-4 rounded-3xl border border-line bg-white/85 p-6 shadow-panel scroll-mt-24">
      <form id="generate-article" onSubmit={onSubmit} className="grid gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-ink">{t("articles.generate.title")}</h2>
          <p className="text-sm text-slate-600">
            {t("articles.generate.description")}
          </p>
        </div>

        <div className="grid gap-2">
          <label htmlFor="keyword" className="text-sm font-medium text-ink">
            {t("articles.generate.keywordLabel")}
          </label>
          <input
            id="keyword"
            name="keyword"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={t("articles.generate.keywordPlaceholder")}
            className="rounded-2xl border border-line px-4 py-3 outline-none transition focus:border-accent"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex w-fit items-center justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? t("articles.generate.generating") : t("articles.generate.submit")}
        </button>
      </form>

      {result?.error ? <p className="text-sm text-red-600">{localizeMessage(result.error)}</p> : null}
      {result?.article ? (
        <div className="rounded-2xl border border-line bg-mist p-4 text-sm text-slate-700">
          <p className="font-semibold text-ink">{result.article.title}</p>
          <p>{t("articles.generate.slug", { slug: result.article.slug })}</p>
          <p>{t("articles.generate.status", { status: result.article.status })}</p>
          <SuggestedKeywords articleId={result.article.id} siteId={siteId} keywords={result.keywords ?? []} />
          <Link
            href={`/${siteId}/articles/${result.article.id}`}
            className="mt-3 inline-flex text-sm font-semibold text-accent hover:underline"
          >
            {t("articles.generate.openInEditor")}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
