"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { assignKeywordToArticle, type ActionState } from "@/lib/actions";

type ArticleKeywordAssignmentProps = {
  articleId: string;
  currentKeywordId?: string | null;
  siteId: string;
  keywords: Array<{
    id: string;
    term: string;
  }>;
};

const initialState: ActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-2xl border border-line px-3 py-2 text-xs font-semibold text-ink transition hover:bg-mist disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Saving..." : "Save Keyword"}
    </button>
  );
}

export function ArticleKeywordAssignment({
  articleId,
  currentKeywordId,
  siteId,
  keywords
}: ArticleKeywordAssignmentProps) {
  const assignKeywordToArticleForSite = assignKeywordToArticle.bind(null, siteId);
  const [state, formAction] = useActionState(assignKeywordToArticleForSite, initialState);

  return (
    <form action={formAction} className="flex flex-col items-start gap-2 md:flex-row md:flex-wrap md:items-center">
      <input type="hidden" name="articleId" value={articleId} />
      <select
        name="keywordId"
        defaultValue={currentKeywordId ?? ""}
        className="min-w-44 rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none"
      >
        <option value="">No keyword</option>
        {keywords.map((keyword) => (
          <option key={keyword.id} value={keyword.id}>
            {keyword.term}
          </option>
        ))}
      </select>

      <SubmitButton />
      {state.error ? <p className="text-xs text-red-600 md:basis-full">{state.error}</p> : null}
      {state.success ? <p className="text-xs text-accent md:basis-full">{state.success}</p> : null}
    </form>
  );
}
