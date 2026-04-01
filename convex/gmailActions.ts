"use node";

import { createClerkClient } from "@clerk/backend";
import { google } from "googleapis";
import { v } from "convex/values";

import { action } from "./_generated/server";

const REQUIRED_GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.send";

async function requireIdentity(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized");
  }
  return identity;
}

function getClerkClient() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Missing CLERK_SECRET_KEY in Convex environment.");
  }

  return createClerkClient({ secretKey });
}

async function getGoogleAccessTokenForUser(userId: string) {
  const clerk = getClerkClient();
  let token:
    | {
        token?: string | null;
        scopes?: string[];
        expiresAt?: number | null;
      }
    | undefined;

  const preferredResponse = await clerk.users.getUserOauthAccessToken(userId, "google");
  token = preferredResponse.data.find((entry) => entry.token);

  if (!token?.token) {
    const legacyResponse = await clerk.users.getUserOauthAccessToken(
      userId,
      "oauth_google",
    );
    token = legacyResponse.data.find((entry) => entry.token);
  }

  if (!token?.token) {
    throw new Error(
      "No Google OAuth access token found in Clerk. Sign in with Google and grant the Gmail send scope.",
    );
  }

  if (!token.scopes?.includes(REQUIRED_GMAIL_SCOPE)) {
    throw new Error(
      "Your Clerk Google sign-in is missing Gmail send permission. Sign out, sign back in with Google, and approve email sending.",
    );
  }

  return token;
}

export const getStatus = action({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);

    try {
      const accessToken = await getGoogleAccessTokenForUser(identity.subject);
      const oauth = new google.auth.OAuth2();
      oauth.setCredentials({ access_token: accessToken.token });
      const gmail = google.gmail({ version: "v1", auth: oauth });
      const profile = await gmail.users.getProfile({ userId: "me" });

      return {
        connected: true,
        email: profile.data.emailAddress ?? null,
        displayName: profile.data.emailAddress ?? null,
        scopes: accessToken.scopes ?? [],
        connectedAt: accessToken.expiresAt ?? null,
      };
    } catch (error) {
      return {
        connected: false,
        email: null,
        displayName: null,
        scopes: [],
        connectedAt: null,
        failureReason:
          error instanceof Error ? error.message : "Google mail token unavailable.",
      };
    }
  },
});

export async function getAuthorizedGmailClient(ctx: any, userId: string) {
  const accessToken = await getGoogleAccessTokenForUser(userId);
  const oauth = new google.auth.OAuth2();
  oauth.setCredentials({
    access_token: accessToken.token,
  });
  const gmail = google.gmail({ version: "v1", auth: oauth });
  const profile = await gmail.users.getProfile({ userId: "me" });

  return {
    gmail,
    account: {
      email: profile.data.emailAddress ?? "",
      displayName: profile.data.emailAddress ?? "",
      scopes: accessToken.scopes ?? [],
      expiresAt: accessToken.expiresAt ?? null,
    },
  };
}
