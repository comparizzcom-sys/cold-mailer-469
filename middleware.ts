import { clerkMiddleware } from "@clerk/nextjs/server";

const authorizedParties = (process.env.CLERK_AUTHORIZED_PARTIES ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

export default clerkMiddleware(
  authorizedParties.length > 0
    ? {
        authorizedParties,
      }
    : undefined,
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
