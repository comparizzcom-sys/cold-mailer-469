import { SignUp } from "@clerk/nextjs";
import { BetaAccessPill } from "@/components/auth/beta-access-pill";

export default function SignUpPage() {
  return (
    <main className="authPage">
      <div className="authStack">
        <BetaAccessPill />
        <SignUp fallbackRedirectUrl="/onboarding" />
      </div>
    </main>
  );
}
