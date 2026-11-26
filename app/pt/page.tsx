import type { Metadata } from "next";

import { LandingPage } from "@/components/landing/landing-page";
import { landingMetadata } from "@/lib/landing/metadata";

export function generateMetadata(): Metadata {
  return landingMetadata("pt");
}

type PortugueseHomePageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default function PortugueseHomePage({ searchParams }: PortugueseHomePageProps) {
  return <LandingPage locale="pt" searchParams={searchParams} />;
}
