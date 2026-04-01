"use node";

import { Buffer } from "node:buffer";

import { DateTime } from "luxon";
import OpenAI from "openai";
import { v } from "convex/values";

import { renderEmailDraft } from "../shared/email-template";
import type { FocusArea } from "../shared/types";
import { getAuthorizedGmailClient } from "./gmail";
import { internal } from "./_generated/api";
import {
  action,
  internalAction,
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
    focusArea: v.union(v.literal("cv"), v.literal("robotics"), v.literal("hybrid")),
    notes: v.string(),
    generatedHook: v.string(),
    html: v.string(),
    plainText: v.string(),
    subject: v.string(),
  };
}

function buildPrompt(args: {
  professorName: string;
  researchTitle: string;
  researchAbstract: string;
  focusArea: FocusArea;
  notes: string;
  goodEmailExamples: string;
}) {
  return [
    "Write one concise paragraph for a cold email to a professor.",
    `Start naturally and mention the paper "${args.researchTitle}".`,
    `Focus area: ${args.focusArea}.`,
    "Keep the tone respectful, specific, and serious about research.",
    "Do not include greeting or sign-off.",
    "Stay under 95 words.",
    args.notes ? `Extra notes from the sender: ${args.notes}` : "",
    args.goodEmailExamples
      ? `Style examples from the sender:\n${args.goodEmailExamples}`
      : "",
    `Professor name: ${args.professorName}`,
    `Paper abstract: ${args.researchAbstract}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function generateHookWithOpenAI(args: {
  professorName: string;
  researchTitle: string;
  researchAbstract: string;
  focusArea: FocusArea;
  notes: string;
  goodEmailExamples: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model: "gpt-4.1-nano",
    input: [
      {
        role: "developer",
        content:
          "You write compact, professional academic outreach paragraphs for students seeking research opportunities.",
      },
      {
        role: "user",
        content: buildPrompt(args),
      },
    ],
  });

  return response.output_text.trim();
}

function toBase64Url(value: Uint8Array) {
  return Buffer.from(value)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}

function buildMimeMessage(args: {
  from: string;
  to: string;
  subject: string;
  html: string;
  plainText: string;
  attachments: Array<{
    fileName: string;
    contentType: string;
    bytes: Uint8Array;
  }>;
}) {
  const mixedBoundary = `mixed_${cryptoRandom()}`;
  const altBoundary = `alt_${cryptoRandom()}`;

  const lines = [
    `From: ${args.from}`,
    `To: ${args.to}`,
    `Subject: ${args.subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    "",
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    "",
    `--${altBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    args.plainText,
    "",
    `--${altBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    args.html,
    "",
    `--${altBoundary}--`,
  ];

  for (const attachment of args.attachments) {
    lines.push(
      "",
      `--${mixedBoundary}`,
      `Content-Type: ${attachment.contentType}; name="${attachment.fileName}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${attachment.fileName}"`,
      "",
      Buffer.from(attachment.bytes).toString("base64"),
    );
  }

  lines.push("", `--${mixedBoundary}--`);

  return toBase64Url(Buffer.from(lines.join("\r\n"), "utf8"));
}

function cryptoRandom() {
  return Math.random().toString(36).slice(2, 12);
}

async function readAttachmentBytes(ctx: any, storageId: any) {
  const blob = await ctx.storage.get(storageId);
  if (!blob) {
    throw new Error(`Attachment ${storageId} no longer exists.`);
  }

  return new Uint8Array(await blob.arrayBuffer());
}

export const generateDraft = action({
  args: {
    professorName: v.string(),
    professorEmail: v.string(),
    researchTitle: v.string(),
    researchAbstract: v.string(),
    focusArea: v.union(v.literal("cv"), v.literal("robotics"), v.literal("hybrid")),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const profile = await ctx.runQuery(internal.profiles.getByUserIdInternal, {
      userId: identity.subject,
    });
    const attachments = await ctx.runQuery(internal.attachments.listByUserIdInternal, {
      userId: identity.subject,
    });

    const generatedHook = await generateHookWithOpenAI({
      professorName: args.professorName,
      researchTitle: args.researchTitle,
      researchAbstract: args.researchAbstract,
      focusArea: args.focusArea,
      notes: args.notes,
      goodEmailExamples: profile.goodEmailExamples ?? "",
    });

    const rendered = renderEmailDraft({
      ...args,
      generatedHook,
      profile,
      attachments: attachments.map((attachment: any) => ({
        id: attachment._id,
        kind: attachment.kind,
        fileName: attachment.fileName,
        storageId: attachment.storageId,
        contentType: attachment.contentType,
      })),
    });

    return {
      generatedHook,
      ...rendered,
    };
  },
});

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
      focusArea: args.focusArea,
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
      internal.emails.sendScheduledEmail,
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

export const sendNow = action({
  args: emailInputArgs(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const attachmentIds = (
      await ctx.runQuery(internal.attachments.listByUserIdInternal, {
        userId: identity.subject,
      })
    ).map((attachment: any) => attachment._id);

    const emailId = await ctx.runMutation(internal.emails.createEmailInternal, {
      userId: identity.subject,
      ...args,
      status: "sending",
      attachmentIds,
    });

    await ctx.runAction(internal.emails.sendScheduledEmail, { emailId });
    return { emailId };
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

export const sendScheduledEmail = internalAction({
  args: {
    emailId: v.id("emails"),
  },
  handler: async (ctx, args) => {
    const email = await ctx.runQuery(internal.emails.getEmailInternal, {
      emailId: args.emailId,
    });

    if (!email || email.status === "sent" || email.status === "cancelled") {
      return;
    }

    await ctx.runMutation(internal.emails.markSendingInternal, {
      emailId: args.emailId,
    });

    try {
      const { gmail, account } = await getAuthorizedGmailClient(ctx, email.userId);
      const attachments = await ctx.runQuery(internal.attachments.getByIdsInternal, {
        ids: email.attachmentIds,
      });

      const resolvedAttachments = [];
      for (const attachment of attachments) {
        if (!attachment) continue;
        resolvedAttachments.push({
          fileName: attachment.fileName,
          contentType: attachment.contentType,
          bytes: await readAttachmentBytes(ctx, attachment.storageId),
        });
      }

      const raw = buildMimeMessage({
        from: account.email,
        to: email.professorEmail,
        subject: email.subject,
        html: email.html,
        plainText: email.plainText,
        attachments: resolvedAttachments,
      });

      const result = await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw,
        },
      });

      await ctx.runMutation(internal.emails.markSentInternal, {
        emailId: args.emailId,
        gmailMessageId: result.data.id ?? "",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to send scheduled email.";
      await ctx.runMutation(internal.emails.markFailedInternal, {
        emailId: args.emailId,
        failureReason: message,
      });
      throw error;
    }
  },
});
