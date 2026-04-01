import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { fetchAction } from "convex/nextjs";

import { api } from "@/convex/_generated/api";
import { getConvexToken, requireUser } from "@/src/lib/auth";
import { assertRuntimeConfig, logRuntimeContext } from "@/src/lib/runtime-config";

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function GET(request: NextRequest) {
  assertRuntimeConfig({
    scope: "gmail-callback",
    requiredKeys: [
      "NEXT_PUBLIC_APP_URL",
      "GOOGLE_CLIENT_ID",
      "GOOGLE_REDIRECT_URI",
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      "CLERK_SECRET_KEY",
      "NEXT_PUBLIC_CONVEX_URL",
    ],
  });

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("gmail_oauth_state")?.value;
  cookieStore.delete("gmail_oauth_state");

  if (error) {
    return NextResponse.redirect(new URL(`/?gmail=${encodeURIComponent(error)}`, appUrl()));
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/?gmail=invalid_state", appUrl()));
  }

  try {
    await requireUser();
    const token = await getConvexToken();
    await fetchAction(
      api.gmailActions.connectComplete,
      { code },
      { token },
    );

    return NextResponse.redirect(new URL("/?gmail=connected", appUrl()));
  } catch (caught) {
    logRuntimeContext("gmail-callback-catch", {
      codePresent: Boolean(code),
      statePresent: Boolean(state),
      expectedStatePresent: Boolean(expectedState),
      errorParam: error ?? null,
    });
    const message =
      caught instanceof Error ? caught.message : "gmail_connection_failed";
    console.error("[gmail-callback-error]", caught);
    return NextResponse.redirect(
      new URL(`/?gmail=${encodeURIComponent(message)}`, appUrl()),
    );
  }
}
