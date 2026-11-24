"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { useLocalizeMessage, useT } from "@/components/i18n-provider";
import { deleteArticle, type ActionState } from "@/lib/actions";

type ArticleDeleteButtonProps = {
  articleId: string;
  articleTitle: string;
  siteId: string;
};

const initialState: ActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useT();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-2xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? t("articles.delete.deleting") : t("articles.delete.delete")}
    </button>
  );
}

export function ArticleDeleteButton({ articleId, articleTitle, siteId }: ArticleDeleteButtonProps) {
  const t = useT();
  const localizeMessage = useLocalizeMessage();
  const deleteArticleForSite = deleteArticle.bind(null, siteId);
  const [state, formAction] = useActionState(deleteArticleForSite, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-col items-start gap-2"
      onSubmit={(event) => {
        if (!window.confirm(t("articles.delete.confirm", { title: articleTitle }))) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="articleId" value={articleId} />
      <SubmitButton />
      {state.error ? <p className="text-xs text-red-600">{localizeMessage(state.error)}</p> : null}
    </form>
  );
}
