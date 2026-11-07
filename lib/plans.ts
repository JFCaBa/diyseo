export type PlanId = "starter" | "pro" | "agency";

export type PlanLimits = {
  sites: number;
  articlesPerMonth: number;
  translations: boolean;
};

export type Plan = {
  id: PlanId;
  name: string;
  tagline: string;
  monthlyPrice: number;
  annualMonthlyPrice: number;
  featured: boolean;
  features: string[];
  limits: PlanLimits;
};

export const PLANS: readonly Plan[] = [
  {
    id: "starter",
    limits: { sites: 1, articlesPerMonth: 12, translations: false },
    name: "Starter",
    tagline: "One website that's ready to grow.",
    monthlyPrice: 29,
    annualMonthlyPrice: 23,
    featured: false,
    features: [
      "1 site",
      "12 articles a month",
      "15 AI questions, checked weekly (coming soon)",
      "1,000 pages crawled (coming soon)",
      "Your data in Claude and ChatGPT (coming soon)",
      "WordPress plugin"
    ]
  },
  {
    id: "pro",
    limits: { sites: 3, articlesPerMonth: 40, translations: true },
    name: "Pro",
    tagline: "A small business that wants the full loop.",
    monthlyPrice: 79,
    annualMonthlyPrice: 63,
    featured: true,
    features: [
      "3 sites",
      "40 articles a month",
      "60 AI questions, checked weekly (coming soon)",
      "5,000 pages crawled (coming soon)",
      "Opportunities and content decay (coming soon)",
      "Translations and your own domain",
      "Campaigns on 1 ad account (coming soon)"
    ]
  },
  {
    id: "agency",
    limits: { sites: 10, articlesPerMonth: 150, translations: true },
    name: "Agency",
    tagline: "Client websites in one dashboard.",
    monthlyPrice: 199,
    annualMonthlyPrice: 159,
    featured: false,
    features: [
      "10 sites, then £15 per extra site",
      "150 articles a month",
      "200 AI questions, checked weekly (coming soon)",
      "25,000 pages crawled (coming soon)",
      "Everything in Pro",
      "Campaigns on 10 ad accounts (coming soon)",
      "White label (coming soon)"
    ]
  }
];

export function isPlanId(value: unknown): value is PlanId {
  return PLANS.some((plan) => plan.id === value);
}
