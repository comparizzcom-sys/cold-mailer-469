import type { Metadata } from "next";
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";

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
  const publishableKey =
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??
    "pk_test_ZXhhbXBsZS5jb20k";
  const session = await auth();
  const isSignedIn = Boolean(session.userId);

  return (
      <html lang="en">
        <body className={`${display.variable} ${mono.variable}`}>
          <ClerkProvider publishableKey={publishableKey}>
            <header className="topbar">
              <div className="topbarInner">
                <div>
                  <strong>Cold Mailer 469</strong>
                </div>
                <nav className="topbarNav">
                  {!isSignedIn ? (
                    <>
                    <SignInButton mode="modal">
                      <button className="topbarButton">Sign in</button>
                    </SignInButton>
                    <SignUpButton mode="modal">
                      <button className="topbarButton ghost">Create account</button>
                    </SignUpButton>
                    </>
                  ) : (
                    <UserButton afterSignOutUrl="/" />
                  )}
                </nav>
              </div>
            </header>
          <AppProviders>{children}</AppProviders>
          </ClerkProvider>
        </body>
      </html>
  );
}
