import { DateTime } from "luxon";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";

async function requireIdentity(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized");
  }
  return identity;
}

function emailInputArgs() {
  return {
    professorName: v.string(),
    professorEmail: v.string(),
    researchTitle: v.string(),
    researchAbstract: v.string(),
    researchField: v.string(),
    notes: v.string(),
    generatedHook: v.string(),
    html: v.string(),
    plainText: v.string(),
    subject: v.string(),
  };
}


export const schedule = mutation({
  args: {
    ...emailInputArgs(),
    scheduledLocalAt: v.string(),
    timezone: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const scheduledAt = DateTime.fromISO(args.scheduledLocalAt, {
      zone: args.timezone,
    });

    if (!scheduledAt.isValid) {
      throw new Error("Invalid scheduled date/time.");
    }

    const attachments = await ctx.db
      .query("attachments")
      .withIndex("by_userId", (query: any) => query.eq("userId", identity.subject))
      .collect();

    const emailId = await ctx.db.insert("emails", {
      userId: identity.subject,
      professorName: args.professorName,
      professorEmail: args.professorEmail,
      researchTitle: args.researchTitle,
      researchAbstract: args.researchAbstract,
      researchField: args.researchField,
      notes: args.notes,
      generatedHook: args.generatedHook,
      subject: args.subject,
      html: args.html,
      plainText: args.plainText,
      status: "scheduled",
      scheduledForUtcMs: scheduledAt.toUTC().toMillis(),
      scheduledTimezone: args.timezone,
      attachmentIds: attachments.map((attachment: any) => attachment._id),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const jobId = await ctx.scheduler.runAt(
      scheduledAt.toUTC().toMillis(),
      internal.emailsActions.sendScheduledEmail,
      { emailId },
    );

    await ctx.db.patch(emailId, {
      scheduledJobId: String(jobId),
      updatedAt: Date.now(),
    });

    return {
      emailId,
      scheduledForUtcMs: scheduledAt.toUTC().toMillis(),
    };
  },
});

export const listScheduled = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    return await ctx.db
      .query("emails")
      .withIndex("by_userId_status", (query: any) =>
        query.eq("userId", identity.subject).eq("status", "scheduled"),
      )
      .collect();
  },
});

export const listRecent = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const rows = await ctx.db
      .query("emails")
      .withIndex("by_userId", (query: any) => query.eq("userId", identity.subject))
      .collect();

    return rows
      .sort((left: any, right: any) => right.createdAt - left.createdAt)
      .slice(0, 20);
  },
});

export const getEmailInternal = internalQuery({
  args: {
    emailId: v.id("emails"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.emailId);
  },
});

export const createEmailInternal = internalMutation({
  args: {
    userId: v.string(),
    ...emailInputArgs(),
    status: v.union(
      v.literal("draft"),
      v.literal("scheduled"),
      v.literal("sending"),
      v.literal("sent"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
    attachmentIds: v.array(v.id("attachments")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("emails", {
      ...args,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const markSendingInternal = internalMutation({
  args: {
    emailId: v.id("emails"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.emailId, {
      status: "sending",
      updatedAt: Date.now(),
      failureReason: undefined,
    });
  },
});

export const markSentInternal = internalMutation({
  args: {
    emailId: v.id("emails"),
    gmailMessageId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.emailId, {
      status: "sent",
      sentAtMs: Date.now(),
      gmailMessageId: args.gmailMessageId,
      failureReason: undefined,
      updatedAt: Date.now(),
    });
  },
});

export const markFailedInternal = internalMutation({
  args: {
    emailId: v.id("emails"),
    failureReason: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.emailId, {
      status: "failed",
      failureReason: args.failureReason,
      updatedAt: Date.now(),
    });
  },
});
