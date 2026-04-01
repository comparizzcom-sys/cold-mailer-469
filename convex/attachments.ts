import { v } from "convex/values";

import { internalQuery, mutation, query } from "./_generated/server";

async function requireIdentity(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized");
  }
  return identity;
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireIdentity(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveMetadata = mutation({
  args: {
    kind: v.union(v.literal("cv"), v.literal("transcript"), v.literal("other")),
    fileName: v.string(),
    contentType: v.string(),
    storageId: v.id("_storage"),
    size: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);

    if (args.kind !== "other") {
      const existing = await ctx.db
        .query("attachments")
        .withIndex("by_userId_kind", (query: any) =>
          query.eq("userId", identity.subject).eq("kind", args.kind),
        )
        .unique();

      if (existing) {
        await ctx.storage.delete(existing.storageId);
        await ctx.db.delete(existing._id);
      }
    }

    return await ctx.db.insert("attachments", {
      userId: identity.subject,
      kind: args.kind,
      fileName: args.fileName,
      contentType: args.contentType,
      storageId: args.storageId,
      size: args.size,
      createdAt: Date.now(),
    });
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    return await ctx.db
      .query("attachments")
      .withIndex("by_userId", (query: any) => query.eq("userId", identity.subject))
      .collect();
  },
});

export const remove = mutation({
  args: {
    attachmentId: v.id("attachments"),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const attachment = await ctx.db.get(args.attachmentId);

    if (!attachment || attachment.userId !== identity.subject) {
      throw new Error("Attachment not found.");
    }

    await ctx.storage.delete(attachment.storageId);
    await ctx.db.delete(args.attachmentId);

    return { removed: true };
  },
});

export const listByUserIdInternal = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("attachments")
      .withIndex("by_userId", (query: any) => query.eq("userId", args.userId))
      .collect();
  },
});

export const getByIdsInternal = internalQuery({
  args: {
    ids: v.array(v.id("attachments")),
  },
  handler: async (ctx, args) => {
    const results = await Promise.all(args.ids.map((id: any) => ctx.db.get(id)));
    return results.filter(Boolean);
  },
});
