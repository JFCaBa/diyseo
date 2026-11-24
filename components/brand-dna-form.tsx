"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { useLocalizeMessage, useT } from "@/components/i18n-provider";
import { updateBrandDNA, type ActionState } from "@/lib/actions";
import type { T } from "@/lib/i18n/translate";

type BrandDNAFormProps = {
  siteId: string;
  initialValues: {
    contentLanguage?: string | null;
    businessType?: string | null;
    brandVoiceTone?: string | null;
    targetAudience?: string | null;
    serviceArea?: string | null;
    topicsToAvoid?: string | null;
    keyThemes?: string | null;
    customImageInstructions?: string | null;
    imageStyle?: string | null;
  };
};

const initialState: ActionState = {};

type BrandDNAValues = Required<{
  [K in keyof BrandDNAFormProps["initialValues"]]: string;
}>;

type GeneratedBrandDNAResult = {
  brandDNA?: Partial<BrandDNAValues>;
  error?: string;
};

type BrandDNAField = {
  id: keyof BrandDNAFormProps["initialValues"];
  label: string;
  rows: number;
  placeholder?: string;
};

type BrandDNASection = {
  title: string;
  description: string;
  fields: BrandDNAField[];
};

function buildSections(t: T): BrandDNASection[] {
  return [
    {
      title: t("brandDna.coreTitle"),
      description: t("brandDna.coreDescription"),
      fields: [
        { id: "contentLanguage", label: t("brandDna.contentLanguage"), rows: 2 },
        { id: "businessType", label: t("brandDna.businessType"), rows: 2 },
        { id: "serviceArea", label: t("brandDna.serviceArea"), rows: 3 }
      ]
    },
    {
      title: t("brandDna.audienceTitle"),
      description: t("brandDna.audienceDescription"),
      fields: [
        { id: "targetAudience", label: t("brandDna.targetAudience"), rows: 4 },
        { id: "brandVoiceTone", label: t("brandDna.brandVoiceTone"), rows: 4 }
      ]
    },
    {
      title: t("brandDna.strategyTitle"),
      description: t("brandDna.strategyDescription"),
      fields: [
        {
          id: "keyThemes",
          label: t("brandDna.keyThemes"),
          rows: 5,
          placeholder: t("brandDna.keyThemesPlaceholder")
        },
        {
          id: "topicsToAvoid",
          label: t("brandDna.topicsToAvoid"),
          rows: 5,
          placeholder: t("brandDna.topicsToAvoidPlaceholder")
        }
      ]
    },
    {
      title: t("brandDna.visualTitle"),
      description: t("brandDna.visualDescription"),
      fields: [
        {
          id: "imageStyle",
          label: t("brandDna.imageStyle"),
          rows: 2,
          placeholder: t("brandDna.imageStylePlaceholder")
        },
        {
          id: "customImageInstructions",
          label: t("brandDna.customImageInstructions"),
          rows: 5,
          placeholder: t("brandDna.customImageInstructionsPlaceholder")
        }
      ]
    }
  ];
}

function SaveButton() {
  const { pending } = useFormStatus();
  const t = useT();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? t("brandDna.saving") : t("brandDna.save")}
    </button>
  );
}

export function BrandDNAForm({ siteId, initialValues }: BrandDNAFormProps) {
  const t = useT();
  const localizeMessage = useLocalizeMessage();
  const sections = buildSections(t);
  const updateBrandDNAForSite = updateBrandDNA.bind(null, siteId);
  const [state, formAction] = useActionState(updateBrandDNAForSite, initialState);
  const [formValues, setFormValues] = useState<BrandDNAValues>({
    contentLanguage: initialValues.contentLanguage ?? "",
    businessType: initialValues.businessType ?? "",
    brandVoiceTone: initialValues.brandVoiceTone ?? "",
    targetAudience: initialValues.targetAudience ?? "",
    serviceArea: initialValues.serviceArea ?? "",
    topicsToAvoid: initialValues.topicsToAvoid ?? "",
    keyThemes: initialValues.keyThemes ?? "",
    customImageInstructions: initialValues.customImageInstructions ?? "",
    imageStyle: initialValues.imageStyle ?? ""
  });
  const [businessDescription, setBusinessDescription] = useState("");
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationSuccess, setGenerationSuccess] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    setFormValues({
      contentLanguage: initialValues.contentLanguage ?? "",
      businessType: initialValues.businessType ?? "",
      brandVoiceTone: initialValues.brandVoiceTone ?? "",
      targetAudience: initialValues.targetAudience ?? "",
      serviceArea: initialValues.serviceArea ?? "",
      topicsToAvoid: initialValues.topicsToAvoid ?? "",
      keyThemes: initialValues.keyThemes ?? "",
      customImageInstructions: initialValues.customImageInstructions ?? "",
      imageStyle: initialValues.imageStyle ?? ""
    });
  }, [initialValues]);

  async function handleGenerateBrandDNA() {
    setIsGenerating(true);
    setGenerationError(null);
    setGenerationSuccess(null);

    try {
      const response = await fetch(`/api/internal/sites/${siteId}/brand-dna/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          businessDescription: businessDescription.trim() || undefined
        })
      });

      const payload = (await response.json()) as GeneratedBrandDNAResult;

      if (!response.ok || !payload.brandDNA) {
        setGenerationError(payload.error ? localizeMessage(payload.error) : t("brandDna.generateFailed"));
        return;
      }

      setFormValues((current) => ({
        ...current,
        ...payload.brandDNA
      }));
      setGenerationSuccess(t("brandDna.generateSuccess"));
    } catch {
      setGenerationError(t("brandDna.generateUnreachable"));
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <form action={formAction} className="grid gap-6">
      <section className="grid gap-4 rounded-3xl border border-line bg-white/90 p-6 shadow-panel">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-ink">{t("brandDna.generateTitle")}</h2>
          <p className="text-sm text-slate-600">
            {t("brandDna.generateDescription")}
          </p>
        </div>

        <div className="grid gap-2">
          <label htmlFor="businessDescription" className="text-sm font-medium text-ink">
            {t("brandDna.businessDescriptionLabel")}
          </label>
          <textarea
            id="businessDescription"
            value={businessDescription}
            onChange={(event) => setBusinessDescription(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder={t("brandDna.businessDescriptionPlaceholder")}
            className="rounded-2xl border border-line px-4 py-3 outline-none transition focus:border-accent"
          />
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm">
            {generationError ? <p className="text-red-600">{generationError}</p> : null}
            {generationSuccess ? <p className="text-accent">{generationSuccess}</p> : null}
          </div>
          <button
            type="button"
            onClick={handleGenerateBrandDNA}
            disabled={isGenerating}
            className="inline-flex items-center justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isGenerating ? t("brandDna.generating") : t("brandDna.generate")}
          </button>
        </div>
      </section>

      {sections.map((section) => (
        <section key={section.title} className="grid gap-5 rounded-3xl border border-line bg-white/90 p-6 shadow-panel">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-ink">{section.title}</h2>
            <p className="text-sm text-slate-600">{section.description}</p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {section.fields.map((field) => (
              <div
                key={field.id}
                className={field.id === "customImageInstructions" ? "grid gap-2 lg:col-span-2" : "grid gap-2"}
              >
                <label htmlFor={field.id} className="text-sm font-medium text-ink">
                  {field.label}
                </label>
                <textarea
                  id={field.id}
                  name={field.id}
                  value={formValues[field.id]}
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      [field.id]: event.target.value
                    }))
                  }
                  rows={field.rows}
                  placeholder={field.placeholder}
                  className="rounded-2xl border border-line px-4 py-3 outline-none transition focus:border-accent"
                />
                {field.id === "keyThemes" || field.id === "topicsToAvoid" ? (
                  <p className="text-xs text-slate-500">{t("brandDna.listHint")}</p>
                ) : null}
                {field.id === "imageStyle" ? (
                  <p className="text-xs text-slate-500">{t("brandDna.imageStyleHint")}</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ))}

      <div className="flex items-center justify-between gap-4 rounded-3xl border border-line bg-white/90 p-6 shadow-panel">
        <div className="text-sm">
          {state.error ? <p className="text-red-600">{localizeMessage(state.error)}</p> : null}
          {state.success ? <p className="text-accent">{localizeMessage(state.success)}</p> : null}
        </div>
        <SaveButton />
      </div>
    </form>
  );
}
