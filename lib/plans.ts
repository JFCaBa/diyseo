export type PlanId = "starter" | "pro" | "agency";

export type Plan = {
  id: PlanId;
  name: string;
  tagline: string;
  monthlyPrice: number;
  annualMonthlyPrice: number;
  featured: boolean;
  features: string[];
};

export const PLANS: readonly Plan[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "One website that's ready to grow.",
    monthlyPrice: 29,
    annualMonthlyPrice: 23,
    featured: false,
    features: [
      "1 site",
      "12 articles a month",
      "15 AI questions, checked weekly",
      "1,000 pages crawled",
      "Your data in Claude and ChatGPT",
      "WordPress plugin"
    ]
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "A small business that wants the full loop.",
    monthlyPrice: 79,
    annualMonthlyPrice: 63,
    featured: true,
    features: [
      "3 sites",
      "40 articles a month",
      "60 AI questions, checked weekly",
      "5,000 pages crawled",
      "Opportunities and content decay",
      "Translations and your own domain",
      "Campaigns on 1 ad account"
    ]
  },
  {
    id: "agency",
    name: "Agency",
    tagline: "Client websites in one dashboard.",
    monthlyPrice: 199,
    annualMonthlyPrice: 159,
    featured: false,
    features: [
      "10 sites, then £15 per extra site",
      "150 articles a month",
      "200 AI questions, checked weekly",
      "25,000 pages crawled",
      "Everything in Pro",
      "Campaigns on 10 ad accounts",
      "White label (coming soon)"
    ]
  }
];

export function isPlanId(value: unknown): value is PlanId {
  return PLANS.some((plan) => plan.id === value);
}
