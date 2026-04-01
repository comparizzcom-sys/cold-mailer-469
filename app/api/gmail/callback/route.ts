import { NextRequest, NextResponse } from "next/server";

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function GET(request: NextRequest) {
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/profile?gmail=${encodeURIComponent(error)}`, appUrl()),
    );
  }

  return NextResponse.redirect(new URL("/profile?gmail=managed-by-clerk", appUrl()));
}
