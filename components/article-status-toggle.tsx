"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { toggleArticleStatus, type ActionState } from "@/lib/actions";

type ArticleStatusToggleProps = {
  articleId: string;
  siteId: string;
  status: "DRAFT" | "PUBLISHED";
};

const initialState: ActionState = {};

function SubmitButton({ status }: { status: "DRAFT" | "PUBLISHED" }) {
  const { pending } = useFormStatus();
  const isDraft = status === "DRAFT";

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-2xl border border-line px-4 py-2 text-sm font-semibold text-ink transition hover:bg-mist disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Saving..." : isDraft ? "Publish" : "Unpublish"}
    </button>
  );
}

export function ArticleStatusToggle({ articleId, siteId, status }: ArticleStatusToggleProps) {
  const toggleArticleStatusForSite = toggleArticleStatus.bind(null, siteId);
  const [state, formAction] = useActionState(toggleArticleStatusForSite, initialState);
  const nextStatus = status === "DRAFT" ? "PUBLISHED" : "DRAFT";

  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <input type="hidden" name="articleId" value={articleId} />
      <input type="hidden" name="status" value={nextStatus} />
      <SubmitButton status={status} />
      {state.error ? <p className="text-xs text-red-600">{state.error}</p> : null}
      {state.success ? <p className="text-xs text-accent">{state.success}</p> : null}
    </form>
  );
}
