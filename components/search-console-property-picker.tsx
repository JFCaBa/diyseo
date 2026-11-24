"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { useLocalizeMessage, useT } from "@/components/i18n-provider";
import { type ActionState, updateSearchConsoleProperty } from "@/lib/actions";
import type { T } from "@/lib/i18n/translate";

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
  const t = useT();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? t("settings.saving") : t("settings.searchConsole.save")}
    </button>
  );
}

const PERMISSION_LEVEL_KEYS = {
  siteOwner: "settings.searchConsole.permissionOwner",
  siteFullUser: "settings.searchConsole.permissionFullUser",
  siteRestrictedUser: "settings.searchConsole.permissionRestrictedUser",
  siteUnverifiedUser: "settings.searchConsole.permissionUnverifiedUser"
} as const;

function formatPermissionLevel(value: string, t: T) {
  const key = PERMISSION_LEVEL_KEYS[value as keyof typeof PERMISSION_LEVEL_KEYS];
  // Levels Google adds later keep the old derived label.
  return key ? t(key) : value.replace(/^site/, "").replace(/([A-Z])/g, " $1").trim();
}

export function SearchConsolePropertyPicker({
  properties,
  selectedPropertyUrl,
  siteId
}: SearchConsolePropertyPickerProps) {
  const t = useT();
  const localizeMessage = useLocalizeMessage();
  const updateSearchConsolePropertyForSite = updateSearchConsoleProperty.bind(null, siteId);
  const [state, formAction] = useActionState(updateSearchConsolePropertyForSite, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-2">
        <label htmlFor="propertyUrl" className="text-sm font-medium text-ink">
          {t("settings.searchConsole.propertyLabel")}
        </label>
        <select
          id="propertyUrl"
          name="propertyUrl"
          defaultValue={selectedPropertyUrl ?? properties[0]?.siteUrl ?? ""}
          className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-accent"
        >
          {properties.map((property) => (
            <option key={property.siteUrl} value={property.siteUrl}>
              {property.isSuggested ? t("settings.searchConsole.suggestedPrefix") : ""}
              {property.siteUrl} ({formatPermissionLevel(property.permissionLevel, t)})
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
            {property.isSuggested ? t("settings.searchConsole.suggestedMatch") : formatPermissionLevel(property.permissionLevel, t)}
          </span>
        ))}
      </div>

      <SubmitButton />
      {state.error ? <p className="text-sm text-red-600">{localizeMessage(state.error)}</p> : null}
      {state.success ? <p className="text-sm text-accent">{localizeMessage(state.success)}</p> : null}
    </form>
  );
}
