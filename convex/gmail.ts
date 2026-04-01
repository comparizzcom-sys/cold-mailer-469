import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";

async function requireIdentity(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized");
  }
  return identity;
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
