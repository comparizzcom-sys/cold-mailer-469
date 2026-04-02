import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="authPage">
      <div className="authStack">
        <div className="authNotice">
          Beta access: contact <a href="mailto:aymaanalam.nitt@gmail.com">aymaanalam.nitt@gmail.com</a> to use Cold Mailer 469.
        </div>
        <SignUp fallbackRedirectUrl="/onboarding" />
      </div>
    </main>
  );
}
