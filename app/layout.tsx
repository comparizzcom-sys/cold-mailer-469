import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";

import { SiteHeader } from "@/components/auth/site-header";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Cold Mailer 469",
  description: "Schedule and send personalized research outreach with Gmail, Convex, and OpenAI.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
      <html lang="en">
        <body className={`${display.variable} ${mono.variable}`}>
          <ClerkProvider>
            <SiteHeader />
            <AppProviders>{children}</AppProviders>
          </ClerkProvider>
        </body>
      </html>
  );
}
