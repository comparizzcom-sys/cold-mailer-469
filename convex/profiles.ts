import { v } from "convex/values";

import { defaultProfile } from "../shared/default-profile";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";

async function requireIdentity(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized");
  }
  return identity;
}

function profileArgs() {
  return {
    fullName: v.string(),
    degree: v.string(),
    school: v.string(),
    location: v.string(),
    phone: v.string(),
    defaultSubject: v.string(),
    introduction: v.string(),
    closingText: v.string(),
    cvHighlights: v.array(v.string()),
    roboticsHighlights: v.array(v.string()),
    hybridHighlights: v.array(v.string()),
    honors: v.array(v.string()),
    publicationBlurb: v.string(),
    goodEmailExamples: v.string(),
  };
}

export const getForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (query: any) => query.eq("userId", identity.subject))
      .unique();

    if (!existing) {
      return {
        ...defaultProfile,
        userId: identity.subject,
      };
    }

    return existing;
  },
});

export const upsert = mutation({
  args: profileArgs(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (query: any) => query.eq("userId", identity.subject))
      .unique();

    const payload = {
      userId: identity.subject,
      ...args,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("profiles", payload);
  },
});

export const getByUserIdInternal = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (query: any) => query.eq("userId", args.userId))
      .unique();

    return existing ?? { ...defaultProfile, userId: args.userId };
  },
});

export const upsertByUserIdInternal = internalMutation({
  args: {
    userId: v.string(),
    ...profileArgs(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (query: any) => query.eq("userId", args.userId))
      .unique();

    const payload = {
      ...args,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("profiles", payload);
  },
});
