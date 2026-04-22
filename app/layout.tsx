import type { Metadata } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "DIYSEO",
  description: "Self-hosted SEO workspace"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
