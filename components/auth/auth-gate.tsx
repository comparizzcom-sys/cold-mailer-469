"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function AuthGate({
  children,
  redirectTo = "/sign-up",
}: {
  children: React.ReactNode;
  redirectTo?: string;
}) {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace(redirectTo);
    }
  }, [isLoaded, isSignedIn, redirectTo, router]);

  if (!isLoaded || !isSignedIn) {
    return (
      <main className="authPage">
        <p>Loading your workspace...</p>
      </main>
    );
  }

  return <>{children}</>;
}
