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
    tagline: "Una web que quiere empezar a crecer.",
    monthlyPrice: 29,
    annualMonthlyPrice: 23,
    featured: false,
    features: [
      "1 sitio",
      "12 artículos al mes",
      "15 preguntas a IA, cada semana",
      "Rastreo de 1.000 páginas",
      "Datos en Claude y ChatGPT",
      "Plugin de WordPress"
    ]
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Una pyme que quiere el ciclo completo.",
    monthlyPrice: 79,
    annualMonthlyPrice: 63,
    featured: true,
    features: [
      "3 sitios",
      "40 artículos al mes",
      "60 preguntas a IA, cada semana",
      "Rastreo de 5.000 páginas",
      "Oportunidades y contenido en caída",
      "Traducciones y tu propio dominio",
      "Campañas en 1 cuenta publicitaria"
    ]
  },
  {
    id: "agency",
    name: "Agencia",
    tagline: "Varias webs de clientes en un panel.",
    monthlyPrice: 199,
    annualMonthlyPrice: 159,
    featured: false,
    features: [
      "10 sitios, y 15 € por cada extra",
      "150 artículos al mes",
      "200 preguntas a IA, cada semana",
      "Rastreo de 25.000 páginas",
      "Todo lo de Pro",
      "Campañas en 10 cuentas publicitarias",
      "Marca blanca (próximamente)"
    ]
  }
];

export function isPlanId(value: unknown): value is PlanId {
  return PLANS.some((plan) => plan.id === value);
}
