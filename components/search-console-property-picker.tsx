"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { type ActionState, updateSearchConsoleProperty } from "@/lib/actions";

type SearchConsolePropertyPickerProps = {
  properties: Array<{
    isSuggested: boolean;
    permissionLevel: string;
    siteUrl: string;
  }>;
  selectedPropertyUrl?: string | null;
  siteId: string;
};

const initialState: ActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Saving..." : "Save property"}
    </button>
  );
}

function formatPermissionLevel(value: string) {
  return value.replace(/^site/, "").replace(/([A-Z])/g, " $1").trim();
}

export function SearchConsolePropertyPicker({
  properties,
  selectedPropertyUrl,
  siteId
}: SearchConsolePropertyPickerProps) {
  const updateSearchConsolePropertyForSite = updateSearchConsoleProperty.bind(null, siteId);
  const [state, formAction] = useActionState(updateSearchConsolePropertyForSite, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-2">
        <label htmlFor="propertyUrl" className="text-sm font-medium text-ink">
          Search Console property
        </label>
        <select
          id="propertyUrl"
          name="propertyUrl"
          defaultValue={selectedPropertyUrl ?? properties[0]?.siteUrl ?? ""}
          className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-accent"
        >
          {properties.map((property) => (
            <option key={property.siteUrl} value={property.siteUrl}>
              {property.isSuggested ? "Suggested: " : ""}
              {property.siteUrl} ({formatPermissionLevel(property.permissionLevel)})
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        {properties.slice(0, 4).map((property) => (
          <span
            key={property.siteUrl}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              property.isSuggested
                ? "bg-accent/10 text-accent"
                : "border border-dashed border-line bg-white text-slate-600"
            }`}
          >
            {property.isSuggested ? "Suggested match" : formatPermissionLevel(property.permissionLevel)}
          </span>
        ))}
      </div>

      <SubmitButton />
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-accent">{state.success}</p> : null}
    </form>
  );
}
