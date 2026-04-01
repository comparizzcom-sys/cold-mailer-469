"use node";

import { google } from "googleapis";
import { v } from "convex/values";

import { getGoogleOAuthConfig } from "../src/lib/gmail-oauth";
import { decryptSecret, encryptSecret } from "./crypto";
import { internal } from "./_generated/api";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";

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

export const getStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const account = await ctx.db
      .query("gmailAccounts")
      .withIndex("by_userId", (query: any) => query.eq("userId", identity.subject))
      .unique();

    return {
      connected: Boolean(account?.isConnected),
      email: account?.email ?? null,
      displayName: account?.displayName ?? null,
      scopes: account?.scopes ?? [],
      connectedAt: account?.createdAt ?? null,
    };
  },
});

export const connectStart = action({
  args: {
    state: v.string(),
  },
  handler: async (_ctx, args) => {
    const oauth = buildOAuthClient();
    const config = getGoogleOAuthConfig();
    const url = oauth.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [config.scope],
      state: args.state,
      include_granted_scopes: true,
    });
    return { url };
  },
});

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

export const disconnect = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const existing = await ctx.db
      .query("gmailAccounts")
      .withIndex("by_userId", (query: any) => query.eq("userId", identity.subject))
      .unique();

    if (!existing) {
      return { disconnected: true };
    }

    await ctx.db.patch(existing._id, {
      isConnected: false,
      updatedAt: Date.now(),
    });

    return { disconnected: true };
  },
});

export const getByUserIdInternal = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("gmailAccounts")
      .withIndex("by_userId", (query: any) => query.eq("userId", args.userId))
      .unique();
  },
});

export const saveConnectionInternal = internalMutation({
  args: {
    userId: v.string(),
    email: v.string(),
    displayName: v.optional(v.string()),
    encryptedRefreshToken: v.string(),
    scopes: v.array(v.string()),
    tokenType: v.optional(v.string()),
    expiryDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("gmailAccounts")
      .withIndex("by_userId", (query: any) => query.eq("userId", args.userId))
      .unique();

    const payload = {
      ...args,
      isConnected: true,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("gmailAccounts", {
      ...payload,
      createdAt: Date.now(),
    });
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
