"use client";

import Link from "next/link";
import {
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth,
} from "@clerk/nextjs";
import { usePathname } from "next/navigation";

export function SiteHeader() {
  const { isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname();

  return (
    <header className="topbar">
      <div className="topbarInner">
        <div>
          <strong>Cold Mailer 469</strong>
        </div>
        <nav className="topbarNav">
          {isLoaded && isSignedIn ? (
            <>
              <Link
                href="/"
                className={`topbarButton ghost${pathname === "/" ? " active" : ""}`}
              >
                Mailing
              </Link>
              <Link
                href="/profile"
                className={`topbarButton ghost${pathname === "/profile" ? " active" : ""}`}
              >
                Profile
              </Link>
              <Link
                href="/help"
                className={`topbarButton ghost${pathname === "/help" ? " active" : ""}`}
              >
                Help
              </Link>
            </>
          ) : null}
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
