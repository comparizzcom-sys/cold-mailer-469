import crypto from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { requireUser } from "@/src/lib/auth";
import { buildGoogleAuthUrl } from "@/src/lib/gmail-oauth";

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function GET() {
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
  } catch {
    return NextResponse.redirect(new URL("/sign-in", appUrl()));
  }
}
