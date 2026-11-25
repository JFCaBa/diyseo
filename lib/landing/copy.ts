import type { UiLocale } from "@/lib/i18n/locale";

/** Landing page text. English is the original page verbatim; `/` must keep rendering it unchanged. */
export type LandingCopy = {
  meta: { title: string; description: string };
  nav: { main: string; loop: string; product: string; pricing: string; openWorkspace: string; signIn: string; startTrial: string };
  accessLimited: string;
  hero: { eyebrow: string; title: string; body: string; cta: string; seePricing: string };
  week: { title: string; example: string; items: { source: string; text: string }[] };
  loop: { title: string; body: string; steps: { title: string; body: string }[] };
  modules: { title: string; items: { status: string; title: string; body: string }[]; footnote: string };
  pricing: {
    title: string;
    intro: string;
    periodLabel: string;
    monthly: string;
    annual: string;
    featured: string;
    perMonth: string;
    cta: string;
  };
  start: { title: string; body: string; cta: string };
  footer: { label: string; blog: string; privacy: string; terms: string };
};

const en: LandingCopy = {
  meta: {
    title: "DIYSEO: get found on Google and in AI answers",
    description:
      "DIYSEO finds the searches you're missing and publishes the content your website lacks, in your brand voice and on your own domain."
  },
  nav: {
    main: "Main",
    loop: "The loop",
    product: "Product",
    pricing: "Pricing",
    openWorkspace: "Open workspace",
    signIn: "Sign in",
    startTrial: "Start free trial"
  },
  accessLimited: "This account can't sign in. Contact info@diyseo.online if you think it should.",
  hero: {
    eyebrow: "For small businesses and agencies",
    title: "Get found on Google and in AI answers.",
    body: "DIYSEO finds the searches you're missing and publishes the content your website lacks, in your brand voice and on your own domain. Then it turns what works into Meta and Google ad campaigns, paused until you approve.",
    cta: "Start your free trial",
    seePricing: "See pricing"
  },
  week: {
    title: "This week on your website",
    example: "Example",
    items: [
      { source: "Google", text: "You rank on page two for “kitchen renovation cost”" },
      { source: "AI answers", text: "ChatGPT cites your competitor instead of you on 3 questions" },
      { source: "Content", text: "Article drafted in your tone, ready to review" },
      { source: "Ads", text: "Campaign drafted and paused until you approve it" }
    ]
  },
  loop: {
    title: "Each step feeds the next.",
    body: "Buying these tools separately easily tops £300 a month, and you'd still have to connect them by hand.",
    steps: [
      { title: "1. Measure", body: "Search Console, Bing, site speed and crawl data, plus what AI assistants say about your brand." },
      { title: "2. Decide", body: "Opportunities, pages losing traffic, and competitors showing up where you don't." },
      { title: "3. Publish", body: "Articles in your tone on your own domain, through WordPress or a widget." },
      { title: "4. Accelerate", body: "What works moves to Meta and Google Ads, landing page included, with no spend until you approve." }
    ]
  },
  modules: {
    title: "What's included",
    items: [
      {
        status: "Available",
        title: "AI blog",
        body: "Articles in your brand voice, automatic publishing, translations, WordPress and publishing on your domain."
      },
      { status: "Available", title: "SEO data", body: "Search Console, Bing, PageSpeed and site crawls, with opportunities and content decay." },
      { status: "Available", title: "AI visibility", body: "What ChatGPT and Gemini tell your customers, and who they cite." },
      {
        status: "Available",
        title: "Ads",
        body: "Meta and Google campaigns with copy, images and a landing page. Always paused until you approve."
      }
    ],
    footnote: "Connect your data to Claude, ChatGPT or Codex and ask about your website with real numbers."
  },
  pricing: {
    title: "Simple pricing",
    intro: "7-day free trial, no card needed. Then choose a plan. Prices in GBP, including any VAT due.",
    periodLabel: "Billing period",
    monthly: "Monthly",
    annual: "Annual, save 20%",
    featured: "Best for small businesses",
    perMonth: " /month",
    cta: "Start free trial"
  },
  start: {
    title: "Try it free for 7 days",
    body: "Sign in with Google and start with the Pro limits. No card needed. Pick a plan when you are ready.",
    cta: "Start your free trial"
  },
  footer: { label: "Footer", blog: "Blog", privacy: "Privacy", terms: "Terms" }
};

const es: LandingCopy = {
  meta: {
    title: "DIYSEO: que te encuentren en Google y en las respuestas de la IA",
    description:
      "DIYSEO encuentra las búsquedas que se te escapan y publica el contenido que le falta a tu web, con la voz de tu marca y en tu propio dominio."
  },
  nav: {
    main: "Principal",
    loop: "El ciclo",
    product: "Producto",
    pricing: "Precios",
    openWorkspace: "Abrir espacio de trabajo",
    signIn: "Iniciar sesión",
    startTrial: "Prueba gratis"
  },
  accessLimited: "Esta cuenta no puede iniciar sesión. Escribe a info@diyseo.online si crees que debería poder.",
  hero: {
    eyebrow: "Para pequeñas empresas y agencias",
    title: "Que te encuentren en Google y en las respuestas de la IA.",
    body: "DIYSEO encuentra las búsquedas que se te escapan y publica el contenido que le falta a tu web, con la voz de tu marca y en tu propio dominio. Después convierte lo que funciona en campañas de Meta y Google Ads, en pausa hasta que tú las apruebes.",
    cta: "Empieza tu prueba gratis",
    seePricing: "Ver precios"
  },
  week: {
    title: "Esta semana en tu web",
    example: "Ejemplo",
    items: [
      { source: "Google", text: "Apareces en la segunda página para «precio reforma cocina»" },
      { source: "Respuestas de IA", text: "ChatGPT cita a tu competencia en vez de a ti en 3 preguntas" },
      { source: "Contenido", text: "Artículo redactado con tu tono, listo para revisar" },
      { source: "Anuncios", text: "Campaña preparada y en pausa hasta que la apruebes" }
    ]
  },
  loop: {
    title: "Cada paso alimenta el siguiente.",
    body: "Contratar estas herramientas por separado supera fácilmente los 300 € al mes, y aún tendrías que conectarlas a mano.",
    steps: [
      { title: "1. Medir", body: "Search Console, Bing, velocidad y rastreo de la web, y lo que dicen de tu marca los asistentes de IA." },
      { title: "2. Decidir", body: "Oportunidades, páginas que pierden tráfico y competidores que aparecen donde tú no." },
      { title: "3. Publicar", body: "Artículos con tu tono en tu propio dominio, con WordPress o con un widget." },
      { title: "4. Acelerar", body: "Lo que funciona pasa a Meta y Google Ads, con landing incluida y sin gastar nada hasta que lo apruebes." }
    ]
  },
  modules: {
    title: "Qué incluye",
    items: [
      {
        status: "Disponible",
        title: "Blog con IA",
        body: "Artículos con la voz de tu marca, publicación automática, traducciones, WordPress y publicación en tu dominio."
      },
      { status: "Disponible", title: "Datos SEO", body: "Search Console, Bing, PageSpeed y rastreos de la web, con oportunidades y contenido en declive." },
      { status: "Disponible", title: "Visibilidad en IA", body: "Lo que ChatGPT y Gemini les dicen a tus clientes, y a quién citan." },
      {
        status: "Disponible",
        title: "Anuncios",
        body: "Campañas de Meta y Google con textos, imágenes y landing. Siempre en pausa hasta que las apruebes."
      }
    ],
    footnote: "Conecta tus datos a Claude, ChatGPT o Codex y pregunta por tu web con cifras reales."
  },
  pricing: {
    title: "Precios sencillos",
    intro: "7 días de prueba gratis, sin tarjeta. Después eliges un plan. Precios en euros, con el IVA que corresponda incluido.",
    periodLabel: "Periodo de facturación",
    monthly: "Mensual",
    annual: "Anual, ahorra un 20 %",
    featured: "El mejor para pequeñas empresas",
    perMonth: " /mes",
    cta: "Prueba gratis"
  },
  start: {
    title: "Pruébalo gratis 7 días",
    body: "Entra con Google y empieza con los límites del plan Pro. Sin tarjeta. Elige un plan cuando quieras.",
    cta: "Empieza tu prueba gratis"
  },
  footer: { label: "Pie de página", blog: "Blog", privacy: "Privacidad", terms: "Términos" }
};

const pt: LandingCopy = {
  meta: {
    title: "DIYSEO: faz com que te encontrem no Google e nas respostas da IA",
    description:
      "O DIYSEO encontra as pesquisas que te estão a escapar e publica o conteúdo que falta no teu site, com a voz da tua marca e no teu próprio domínio."
  },
  nav: {
    main: "Principal",
    loop: "O ciclo",
    product: "Produto",
    pricing: "Preços",
    openWorkspace: "Abrir espaço de trabalho",
    signIn: "Iniciar sessão",
    startTrial: "Experimenta grátis"
  },
  accessLimited: "Esta conta não pode iniciar sessão. Escreve para info@diyseo.online se achas que devia poder.",
  hero: {
    eyebrow: "Para pequenas empresas e agências",
    title: "Faz com que te encontrem no Google e nas respostas da IA.",
    body: "O DIYSEO encontra as pesquisas que te estão a escapar e publica o conteúdo que falta no teu site, com a voz da tua marca e no teu próprio domínio. Depois transforma o que funciona em campanhas de Meta e Google Ads, em pausa até as aprovares.",
    cta: "Começa a tua experiência grátis",
    seePricing: "Ver preços"
  },
  week: {
    title: "Esta semana no teu site",
    example: "Exemplo",
    items: [
      { source: "Google", text: "Apareces na segunda página para «preço remodelação cozinha»" },
      { source: "Respostas da IA", text: "O ChatGPT cita a tua concorrência em vez de ti em 3 perguntas" },
      { source: "Conteúdo", text: "Artigo redigido no teu tom, pronto para rever" },
      { source: "Anúncios", text: "Campanha preparada e em pausa até a aprovares" }
    ]
  },
  loop: {
    title: "Cada passo alimenta o seguinte.",
    body: "Contratar estas ferramentas em separado passa facilmente dos 300 € por mês, e ainda terias de as ligar à mão.",
    steps: [
      { title: "1. Medir", body: "Search Console, Bing, velocidade e rastreio do site, e o que os assistentes de IA dizem da tua marca." },
      { title: "2. Decidir", body: "Oportunidades, páginas a perder tráfego e concorrentes que aparecem onde tu não apareces." },
      { title: "3. Publicar", body: "Artigos no teu tom no teu próprio domínio, com WordPress ou com um widget." },
      { title: "4. Acelerar", body: "O que funciona passa para Meta e Google Ads, com landing incluída e sem gastar nada até aprovares." }
    ]
  },
  modules: {
    title: "O que inclui",
    items: [
      {
        status: "Disponível",
        title: "Blog com IA",
        body: "Artigos com a voz da tua marca, publicação automática, traduções, WordPress e publicação no teu domínio."
      },
      { status: "Disponível", title: "Dados de SEO", body: "Search Console, Bing, PageSpeed e rastreios do site, com oportunidades e conteúdo em declínio." },
      { status: "Disponível", title: "Visibilidade na IA", body: "O que o ChatGPT e o Gemini dizem aos teus clientes, e quem citam." },
      {
        status: "Disponível",
        title: "Anúncios",
        body: "Campanhas de Meta e Google com textos, imagens e landing. Sempre em pausa até as aprovares."
      }
    ],
    footnote: "Liga os teus dados ao Claude, ao ChatGPT ou ao Codex e pergunta pelo teu site com números reais."
  },
  pricing: {
    title: "Preços simples",
    intro: "7 dias de experiência grátis, sem cartão. Depois escolhes um plano. Preços em euros, com o IVA aplicável incluído.",
    periodLabel: "Período de faturação",
    monthly: "Mensal",
    annual: "Anual, poupa 20 %",
    featured: "O melhor para pequenas empresas",
    perMonth: " /mês",
    cta: "Experimenta grátis"
  },
  start: {
    title: "Experimenta grátis durante 7 dias",
    body: "Entra com o Google e começa com os limites do plano Pro. Sem cartão. Escolhe um plano quando quiseres.",
    cta: "Começa a tua experiência grátis"
  },
  footer: { label: "Rodapé", blog: "Blog", privacy: "Privacidade", terms: "Termos" }
};

export const LANDING_COPY: Record<UiLocale, LandingCopy> = { en, es, pt };

/** Each language named in itself, for the landing header links to the other landings. */
export const LANGUAGE_NAME: Record<UiLocale, string> = { en: "English", es: "Español", pt: "Português" };

/** Landing path of each language; `/` is the English original and the x-default. */
export const LANDING_PATH: Record<UiLocale, string> = { en: "/", es: "/es", pt: "/pt" };

/** Each landing sells in one currency: pounds on `/`, euros on `/es` and `/pt`. */
export const LANDING_CURRENCY = { en: "gbp", es: "eur", pt: "eur" } as const satisfies Record<UiLocale, "gbp" | "eur">;
