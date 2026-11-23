import type { Metadata } from "next";

import "@/app/globals.css";
import { getUiLocale } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "DIYSEO",
  description: "Self-hosted SEO workspace",
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png", sizes: "64x64" },
      { url: "/favicon.ico", rel: "shortcut icon" }
    ],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }]
  }
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={await getUiLocale()}>
      <body className="font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
