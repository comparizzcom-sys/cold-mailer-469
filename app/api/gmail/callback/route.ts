import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { fetchAction } from "convex/nextjs";

import { api } from "@/convex/_generated/api";
import { getConvexToken, requireUser } from "@/src/lib/auth";

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function GET(request: NextRequest) {
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
    const message =
      caught instanceof Error ? caught.message : "gmail_connection_failed";
    return NextResponse.redirect(
      new URL(`/?gmail=${encodeURIComponent(message)}`, appUrl()),
    );
  }
}
