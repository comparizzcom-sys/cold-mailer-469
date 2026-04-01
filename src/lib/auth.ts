import { auth } from "@clerk/nextjs/server";
import { logRuntimeContext } from "@/src/lib/runtime-config";

export async function requireUser() {
  const session = await auth();
  if (!session.userId) {
    logRuntimeContext("requireUser", {
      reason: "Missing userId from Clerk session",
    });
    throw new Error("Unauthorized");
  }
  return session;
}

export async function getConvexToken() {
  const session = await auth();
  const token = (await session.getToken({ template: "convex" })) ?? undefined;
  if (!token) {
    logRuntimeContext("getConvexToken", {
      reason: "Missing Convex token from Clerk template",
    });
  }
  return token;
}
