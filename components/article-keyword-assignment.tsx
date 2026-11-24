"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { useLocalizeMessage, useT } from "@/components/i18n-provider";
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
  const t = useT();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-2xl border border-line px-3 py-2 text-xs font-semibold text-ink transition hover:bg-mist disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? t("articles.keyword.saving") : t("articles.keyword.save")}
    </button>
  );
}

export function ArticleKeywordAssignment({
  articleId,
  currentKeywordId,
  siteId,
  keywords
}: ArticleKeywordAssignmentProps) {
  const t = useT();
  const localizeMessage = useLocalizeMessage();
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
        <option value="">{t("articles.keyword.none")}</option>
        {keywords.map((keyword) => (
          <option key={keyword.id} value={keyword.id}>
            {keyword.term}
          </option>
        ))}
      </select>

      <SubmitButton />
      {state.error ? <p className="text-xs text-red-600 md:basis-full">{localizeMessage(state.error)}</p> : null}
      {state.success ? <p className="text-xs text-accent md:basis-full">{localizeMessage(state.success)}</p> : null}
    </form>
  );
}
