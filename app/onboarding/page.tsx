import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { OnboardingForm } from "@/components/dashboard/onboarding-form";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session.userId) {
    redirect("/sign-up");
  }

  return <OnboardingForm />;
}
