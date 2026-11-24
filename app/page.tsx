import type { Metadata } from "next";

import { LandingPage } from "@/components/landing/landing-page";
import { landingMetadata } from "@/lib/landing/metadata";

export function generateMetadata(): Metadata {
  return landingMetadata("en");
}

type HomePageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default function HomePage({ searchParams }: HomePageProps) {
  return <LandingPage locale="en" searchParams={searchParams} />;
}
