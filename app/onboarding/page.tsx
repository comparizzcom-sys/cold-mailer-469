import { AuthGate } from "@/components/auth/auth-gate";
import { OnboardingForm } from "@/components/dashboard/onboarding-form";

export default function OnboardingPage() {
  return (
    <AuthGate>
      <OnboardingForm />
    </AuthGate>
  );
}
