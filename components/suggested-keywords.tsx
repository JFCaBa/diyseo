"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { assignKeywordToArticle, type ActionState } from "@/lib/actions";

type SuggestedKeywordsProps = {
  articleId: string;
  siteId: string;
  keywords: Array<{
    id: string;
    term: string;
  }>;
};

const initialState: ActionState = {};

function AssignButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-ink transition hover:bg-mist disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Assigning..." : "Assign to article"}
    </button>
  );
}

export function SuggestedKeywords({ articleId, siteId, keywords }: SuggestedKeywordsProps) {
  const assignKeywordToArticleForSite = assignKeywordToArticle.bind(null, siteId);
  const [state, formAction] = useActionState(assignKeywordToArticleForSite, initialState);

  if (keywords.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 rounded-2xl border border-line bg-white p-4">
      <div>
        <h3 className="text-sm font-semibold text-ink">Suggested keywords</h3>
        <p className="mt-1 text-xs text-slate-600">
          These were saved to this site. Pick one if it should be attached to the draft.
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {keywords.map((keyword) => (
          <form key={keyword.id} action={formAction} className="flex items-center gap-2 rounded-full bg-mist px-3 py-2">
            <input type="hidden" name="articleId" value={articleId} />
            <input type="hidden" name="keywordId" value={keyword.id} />
            <span className="text-xs font-semibold text-accent">{keyword.term}</span>
            <AssignButton />
          </form>
        ))}
      </div>

      {state.error ? <p className="mt-3 text-xs text-red-600">{state.error}</p> : null}
      {state.success ? <p className="mt-3 text-xs text-accent">{state.success}</p> : null}
    </div>
  );
}
