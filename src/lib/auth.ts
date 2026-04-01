import { auth } from "@clerk/nextjs/server";

export async function requireUser() {
  const session = await auth();
  if (!session.userId) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function getConvexToken() {
  const session = await auth();
  return (await session.getToken({ template: "convex" })) ?? undefined;
}
