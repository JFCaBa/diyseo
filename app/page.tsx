import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignInButton } from "@/components/auth-buttons";
import { Pricing } from "@/components/landing/pricing";
import { WaitlistForm } from "@/components/landing/waitlist-form";
import { auth } from "@/lib/auth";
import { isPlanId } from "@/lib/plans";
import { prisma } from "@/lib/prisma";

const inter = Inter({ subsets: ["latin"], variable: "--font-landing-body" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-landing-display" });

export const metadata: Metadata = {
  title: "DIYSEO: que te encuentren en Google, en la IA y en los anuncios",
  description:
    "DIYSEO detecta qué búsquedas estás perdiendo, publica el contenido que falta en tu web y convierte lo que funciona en campañas."
};

const weekExample = [
  { source: "Google", text: "Sales en la segunda página para «reformar cocina precio»" },
  { source: "Respuestas de IA", text: "ChatGPT cita a tu competidor y no a ti en 3 preguntas" },
  { source: "Contenido", text: "Artículo redactado con tu tono, listo para revisar" },
  { source: "Anuncios", text: "Campaña en borrador, en pausa hasta que tú la apruebes" }
];

const cycle = [
  { title: "1. Mide", body: "Search Console, Bing, velocidad y rastreo de tu web, y lo que responden las IA sobre tu marca." },
  { title: "2. Decide", body: "Oportunidades, páginas en caída y competidores que aparecen donde tú no." },
  { title: "3. Publica", body: "Artículos con tu tono y en tu dominio, en WordPress o con un widget." },
  { title: "4. Acelera", body: "Lo que funciona pasa a Meta y Google Ads, con landing incluida y sin gastar nada hasta que apruebes." }
];

const modules = [
  {
    status: "Disponible",
    live: true,
    title: "Blog con IA",
    body: "Artículos con tu tono de marca, publicación automática, traducciones, WordPress y publicación en tu dominio."
  },
  {
    status: "Acceso anticipado",
    live: false,
    title: "Datos SEO",
    body: "Search Console, Bing, PageSpeed y rastreo de tu web, con oportunidades y contenido en caída."
  },
  {
    status: "Acceso anticipado",
    live: false,
    title: "Visibilidad en IA",
    body: "Qué responden ChatGPT y Gemini a las preguntas de tus clientes, y a quién citan."
  },
  {
    status: "Acceso anticipado",
    live: false,
    title: "Anuncios",
    body: "Campañas de Meta y Google con textos, imágenes y landing. Siempre en pausa hasta que apruebes."
  }
];

const heading = "font-display text-4xl font-bold leading-tight tracking-tight";
const wrap = "mx-auto max-w-[1180px] px-6";

type HomePageProps = {
  searchParams?: Promise<{ error?: string; plan?: string }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const session = await auth();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const plan = isPlanId(resolvedSearchParams?.plan) ? resolvedSearchParams.plan : null;

  // A plan link is an explicit request for this page, so it wins over the jump to the workspace.
  if (session?.user?.id && !plan) {
    const workspace = await prisma.workspace.findUnique({
      where: { ownerId: session.user.id },
      select: {
        sites: {
          orderBy: { createdAt: "asc" },
          select: { id: true }
        }
      }
    });

    redirect(workspace?.sites[0]?.id ? `/${workspace.sites[0].id}` : "/settings");
  }

  return (
    <main lang="es" className={`${inter.variable} ${spaceGrotesk.variable} overflow-x-clip bg-[#fbfaf6] font-body leading-relaxed text-ink`}>
      <header className={`${wrap} flex items-center justify-between gap-4 py-5`}>
        <Link href="/" className="font-display text-xl font-bold">
          DIYSEO
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-6 text-[15px] text-slate-700">
          <a href="#ciclo" className="hidden hover:text-ink md:inline">
            El ciclo
          </a>
          <a href="#modulos" className="hidden hover:text-ink md:inline">
            Producto
          </a>
          <a href="#precios" className="hidden hover:text-ink md:inline">
            Precios
          </a>
          {session?.user ? (
            <Link href="/settings" className="hover:text-ink">
              Abrir panel
            </Link>
          ) : (
            <SignInButton label="Entrar" className="hover:text-ink" />
          )}
          <a href="#acceso" className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800">
            Pedir acceso
          </a>
        </nav>
      </header>

      {resolvedSearchParams?.error === "access_limited" ? (
        <div className={wrap}>
          <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            El acceso está limitado por ahora. Apúntate a la lista y te avisaremos.
          </p>
        </div>
      ) : null}

      <section className={`${wrap} grid items-center gap-9 pb-[88px] pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14`}>
        <div>
          <p className="mb-4 text-[15px] font-semibold text-accent">Para pymes y agencias que venden en español</p>
          <h1 className="font-display text-[40px] font-bold leading-[1.05] tracking-tight md:text-[60px]">
            Que te encuentren en Google, en la IA y en los anuncios.
          </h1>
          <p className="mt-5 max-w-[560px] text-[19px] text-slate-600">
            DIYSEO detecta qué búsquedas estás perdiendo, publica el contenido que falta en tu web y convierte lo que
            funciona en campañas. Todo en un mismo sitio.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#acceso" className="rounded-lg bg-accent px-5 py-3.5 font-semibold text-white transition hover:bg-teal-800">
              Pedir acceso
            </a>
            <a href="#precios" className="rounded-lg border border-slate-400 px-5 py-3.5 font-semibold transition hover:bg-white">
              Ver precios
            </a>
          </div>
        </div>

        <div className="rounded-[14px] border border-line bg-white p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">Esta semana en tu web</h2>
            <span className="text-xs text-slate-600">Ejemplo</span>
          </div>
          <div className="mt-3 divide-y divide-[#e8edf1]">
            {weekExample.map((item) => (
              <div key={item.source} className="py-3">
                <p className="text-xs font-semibold text-accent">{item.source}</p>
                <p className="mt-0.5 text-[15px]">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="ciclo" className="scroll-mt-4 bg-ink py-20 text-slate-50">
        <div className={wrap}>
          <h2 className={`${heading} max-w-[720px]`}>Cada paso alimenta al siguiente.</h2>
          <p className="mt-4 max-w-[640px] text-lg text-slate-300">
            Comprar estas piezas por separado supera fácilmente los 300 € al mes, y aun así tendrías que unirlas a mano.
          </p>
          <ol className="mt-11 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cycle.map((step) => (
              <li key={step.title} className="border-t-2 border-teal-300 pt-4">
                <p className="font-display text-[22px] font-semibold">{step.title}</p>
                <p className="mt-2 text-slate-300">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="modulos" className={`${wrap} scroll-mt-4 py-20`}>
        <h2 className={heading}>Lo que incluye</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((module) => (
            <article key={module.title} className="flex flex-col gap-2.5 rounded-[14px] border border-line bg-white p-5">
              <span
                className={`self-start rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  module.live ? "bg-teal-100 text-teal-800" : "bg-amber-100 text-amber-900"
                }`}
              >
                {module.status}
              </span>
              <h3 className="font-display text-xl font-semibold">{module.title}</h3>
              <p className="text-[15px] text-slate-600">{module.body}</p>
            </article>
          ))}
        </div>
        <p className="mt-5 text-[15px] text-slate-600">
          Conecta los datos a Claude, ChatGPT o Codex y pregúntales por tu web con cifras reales.
        </p>
      </section>

      <section id="precios" className="scroll-mt-4 bg-[#f1efe8] py-20">
        <div className={wrap}>
          <Pricing />
        </div>
      </section>

      <section id="acceso" className={`${wrap} relative scroll-mt-4 py-20`}>
        <div className="max-w-[620px]">
          <h2 className={heading}>Abrimos plazas poco a poco</h2>
          <p className="mt-3 text-lg text-slate-600">Déjanos tu email y te avisamos cuando tengas sitio. Sin compromiso.</p>
          <WaitlistForm key={plan ?? "none"} defaultPlan={plan} />
        </div>
      </section>

      <footer className="border-t border-line">
        <div className={`${wrap} flex flex-wrap justify-between gap-4 py-6 text-sm text-slate-600`}>
          <span>DIYSEO</span>
          <nav aria-label="Pie" className="flex flex-wrap gap-5">
            <Link href="/blog" className="hover:text-ink">
              Blog
            </Link>
            <Link href="/privacy" className="hover:text-ink">
              Privacidad
            </Link>
            <Link href="/terms" className="hover:text-ink">
              Términos
            </Link>
            <a href="https://github.com/JFCaBa/diyseo" target="_blank" rel="noreferrer" className="hover:text-ink">
              GitHub
            </a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
