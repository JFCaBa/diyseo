"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { updateBrandDNA, type ActionState } from "@/lib/actions";

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

const sections: BrandDNASection[] = [
  {
    title: "Core Identity",
    description: "Foundational details that describe the site, business model, and operating context.",
    fields: [
      {
        id: "contentLanguage",
        label: "Content Language",
        rows: 2
      },
      {
        id: "businessType",
        label: "Business Type",
        rows: 2
      },
      {
        id: "serviceArea",
        label: "Service Area",
        rows: 3
      }
    ]
  },
  {
    title: "Audience & Voice",
    description: "Describe who the brand is speaking to and how the voice should feel in editorial content.",
    fields: [
      {
        id: "targetAudience",
        label: "Target Audience",
        rows: 4
      },
      {
        id: "brandVoiceTone",
        label: "Brand Voice & Tone",
        rows: 4
      }
    ]
  },
  {
    title: "Content Strategy",
    description: "Use one item per line or comma-separated input. Values are normalized into a clean line-based format on save.",
    fields: [
      {
        id: "keyThemes",
        label: "Key Themes",
        rows: 5,
        placeholder: "Local SEO wins\nHome service marketing\nWebsite ownership"
      },
      {
        id: "topicsToAvoid",
        label: "Topics to Avoid",
        rows: 5,
        placeholder: "Black-hat tactics\nUnverifiable guarantees\nOff-brand commentary"
      }
    ]
  },
  {
    title: "Visual Identity",
    description: "Capture visual direction that can be reused later in prompts without re-explaining the style each time.",
    fields: [
      {
        id: "imageStyle",
        label: "Image Style",
        rows: 2,
        placeholder: "Editorial photography"
      },
      {
        id: "customImageInstructions",
        label: "Custom Image Instructions",
        rows: 5,
        placeholder: "Use clean compositions, realistic lighting, and avoid generic stock-style office scenes."
      }
    ]
  }
];

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Saving..." : "Save Brand DNA"}
    </button>
  );
}

export function BrandDNAForm({ siteId, initialValues }: BrandDNAFormProps) {
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
        setGenerationError(payload.error || "Brand DNA generation failed.");
        return;
      }

      setFormValues((current) => ({
        ...current,
        ...payload.brandDNA
      }));
      setGenerationSuccess("Draft Brand DNA generated and saved. Review and edit before saving again if needed.");
    } catch {
      setGenerationError("Unable to reach the Brand DNA generation endpoint.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <form action={formAction} className="grid gap-6">
      <section className="grid gap-4 rounded-3xl border border-line bg-white/90 p-6 shadow-panel">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-ink">Auto-Generate Draft</h2>
          <p className="text-sm text-slate-600">
            Use the site name, domain, and an optional business description to draft Brand DNA values you can edit.
          </p>
        </div>

        <div className="grid gap-2">
          <label htmlFor="businessDescription" className="text-sm font-medium text-ink">
            Optional business description
          </label>
          <textarea
            id="businessDescription"
            value={businessDescription}
            onChange={(event) => setBusinessDescription(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder="What does the business do, who does it serve, and what makes it different?"
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
            {isGenerating ? "Generating..." : "Auto-Generate Brand DNA"}
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
                  <p className="text-xs text-slate-500">Separate entries with new lines or commas.</p>
                ) : null}
                {field.id === "imageStyle" ? (
                  <p className="text-xs text-slate-500">Keep this short and reusable, for example: “Minimal product illustration”.</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ))}

      <div className="flex items-center justify-between gap-4 rounded-3xl border border-line bg-white/90 p-6 shadow-panel">
        <div className="text-sm">
          {state.error ? <p className="text-red-600">{state.error}</p> : null}
          {state.success ? <p className="text-accent">{state.success}</p> : null}
        </div>
        <SaveButton />
      </div>
    </form>
  );
}
