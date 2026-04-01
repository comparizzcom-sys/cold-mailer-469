import { NextResponse } from "next/server";

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function GET() {
  return NextResponse.redirect(new URL("/profile?gmail=managed-by-clerk", appUrl()));
}
