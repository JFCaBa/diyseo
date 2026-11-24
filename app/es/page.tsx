import type { Metadata } from "next";

import { LandingPage } from "@/components/landing/landing-page";
import { landingMetadata } from "@/lib/landing/metadata";

export function generateMetadata(): Metadata {
  return landingMetadata("es");
}

type SpanishHomePageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default function SpanishHomePage({ searchParams }: SpanishHomePageProps) {
  return <LandingPage locale="es" searchParams={searchParams} />;
}
