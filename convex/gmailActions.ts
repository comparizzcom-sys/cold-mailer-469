"use node";

import { google } from "googleapis";
import { v } from "convex/values";

import { getGoogleOAuthConfig } from "../src/lib/gmail-oauth";
import { decryptSecret, encryptSecret } from "./crypto";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";

async function requireIdentity(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized");
  }
  return identity;
}

function buildOAuthClient() {
  const config = getGoogleOAuthConfig();
  return new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    config.redirectUri,
  );
}

export const connectComplete = action({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const oauth = buildOAuthClient();
    const { tokens } = await oauth.getToken(args.code);
    oauth.setCredentials(tokens);

    if (!tokens.refresh_token) {
      throw new Error(
        "Google did not return a refresh token. Re-consent with prompt=consent.",
      );
    }

    const gmail = google.gmail({ version: "v1", auth: oauth });
    const profile = await gmail.users.getProfile({ userId: "me" });

    await ctx.runMutation(internal.gmail.saveConnectionInternal, {
      userId: identity.subject,
      email: profile.data.emailAddress ?? "",
      displayName: profile.data.emailAddress ?? "",
      encryptedRefreshToken: encryptSecret(tokens.refresh_token),
      scopes: tokens.scope?.split(" ") ?? ["https://www.googleapis.com/auth/gmail.send"],
      tokenType: tokens.token_type ?? "Bearer",
      expiryDate: tokens.expiry_date ?? undefined,
    });

    return {
      email: profile.data.emailAddress ?? "",
      connected: true,
    };
  },
});

export async function getAuthorizedGmailClient(ctx: any, userId: string) {
  const account = await ctx.runQuery(internal.gmail.getByUserIdInternal, {
    userId,
  });

  if (!account?.isConnected) {
    throw new Error("No connected Gmail account found.");
  }

  const oauth = buildOAuthClient();
  oauth.setCredentials({
    refresh_token: decryptSecret(account.encryptedRefreshToken),
  });

  return {
    gmail: google.gmail({ version: "v1", auth: oauth }),
    account,
  };
}
