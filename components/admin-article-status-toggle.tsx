"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { adminToggleArticleStatus, type AdminArticleToggleState } from "@/app/admin/actions";

type AdminArticleStatusToggleProps = {
  articleId: string;
  status: "DRAFT" | "PUBLISHED";
};

const initialState: AdminArticleToggleState = {};

function SubmitButton({ status }: { status: "DRAFT" | "PUBLISHED" }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center justify-center rounded-lg px-3 py-1 text-xs font-semibold transition disabled:opacity-50 ${
        status === "DRAFT"
          ? "bg-teal-600 text-white hover:bg-teal-500"
          : "border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300"
      }`}
    >
      {pending ? "..." : status === "DRAFT" ? "Publish" : "Unpublish"}
    </button>
  );
}

export function AdminArticleStatusToggle({ articleId, status }: AdminArticleStatusToggleProps) {
  const [state, formAction] = useActionState(adminToggleArticleStatus, initialState);
  const nextStatus = status === "DRAFT" ? "PUBLISHED" : "DRAFT";

  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <input type="hidden" name="articleId" value={articleId} />
      <input type="hidden" name="status" value={nextStatus} />
      <SubmitButton status={status} />
      {state.error ? <p className="text-xs text-red-400">{state.error}</p> : null}
      {state.success ? <p className="text-xs text-teal-400">{state.success}</p> : null}
    </form>
  );
}
