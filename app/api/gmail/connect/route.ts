import crypto from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { requireUser } from "@/src/lib/auth";
import { buildGoogleAuthUrl } from "@/src/lib/gmail-oauth";
import { assertRuntimeConfig, logRuntimeContext } from "@/src/lib/runtime-config";

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function GET() {
  assertRuntimeConfig({
    scope: "gmail-connect",
    requiredKeys: [
      "NEXT_PUBLIC_APP_URL",
      "GOOGLE_CLIENT_ID",
      "GOOGLE_REDIRECT_URI",
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      "CLERK_SECRET_KEY",
    ],
  });

  try {
    await requireUser();
    const state = crypto.randomUUID();
    const cookieStore = await cookies();
    cookieStore.set("gmail_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10,
    });

    return NextResponse.redirect(buildGoogleAuthUrl(state));
  } catch (caught) {
    logRuntimeContext("gmail-connect-catch");
    console.error("[gmail-connect-error]", caught);
    return NextResponse.redirect(new URL("/sign-in", appUrl()));
  }
}
