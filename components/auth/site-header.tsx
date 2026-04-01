"use client";

import {
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth,
} from "@clerk/nextjs";

export function SiteHeader() {
  const { isLoaded, isSignedIn } = useAuth();

  return (
    <header className="topbar">
      <div className="topbarInner">
        <div>
          <strong>Cold Mailer 469</strong>
        </div>
        <nav className="topbarNav">
          {isLoaded && !isSignedIn ? (
            <>
              <SignInButton mode="modal">
                <button className="topbarButton">Sign in</button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="topbarButton ghost">Create account</button>
              </SignUpButton>
            </>
          ) : null}
          {isLoaded && isSignedIn ? <UserButton afterSignOutUrl="/" /> : null}
        </nav>
      </div>
    </header>
  );
}
