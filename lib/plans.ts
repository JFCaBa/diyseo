export type PlanId = "starter" | "pro" | "agency";

export type PlanLimits = {
  sites: number;
  articlesPerMonth: number;
  translations: boolean;
  /** Team seats; `null` means unlimited. */
  members: number | null;
  aiQuestions: number;
  adBusinesses: number;
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
    limits: { sites: 1, articlesPerMonth: 12, translations: false, members: 1, aiQuestions: 15, adBusinesses: 0 },
    name: "Starter",
    tagline: "One website that's ready to grow.",
    monthlyPrice: 29,
    annualMonthlyPrice: 23,
    featured: false,
    features: [
      "1 site",
      "1 team member",
      "12 articles a month",
      "15 AI questions, checked weekly",
      "1,000 pages crawled a month",
      "Your data in Claude and ChatGPT",
      "WordPress plugin"
    ]
  },
  {
    id: "pro",
    limits: { sites: 3, articlesPerMonth: 40, translations: true, members: 3, aiQuestions: 60, adBusinesses: 1 },
    name: "Pro",
    tagline: "A small business that wants the full loop.",
    monthlyPrice: 79,
    annualMonthlyPrice: 63,
    featured: true,
    features: [
      "3 sites",
      "3 team members",
      "40 articles a month",
      "60 AI questions, checked weekly",
      "5,000 pages crawled a month",
      "Opportunities and content decay",
      "Translations and your own domain",
      "Campaigns on 1 ad account"
    ]
  },
  {
    id: "agency",
    limits: { sites: 10, articlesPerMonth: 150, translations: true, members: null, aiQuestions: 200, adBusinesses: 10 },
    name: "Agency",
    tagline: "Client websites in one dashboard.",
    monthlyPrice: 199,
    annualMonthlyPrice: 159,
    featured: false,
    features: [
      "10 sites, then £15 per extra site",
      "Unlimited team members",
      "150 articles a month",
      "200 AI questions, checked weekly",
      "25,000 pages crawled a month",
      "Everything in Pro",
      "Campaigns on 10 ad accounts",
      "White label (coming soon)"
    ]
  }
];

export function isPlanId(value: unknown): value is PlanId {
  return PLANS.some((plan) => plan.id === value);
}
