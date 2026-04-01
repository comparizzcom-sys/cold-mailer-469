"use node";

import { Buffer } from "node:buffer";

import OpenAI from "openai";
import { v } from "convex/values";

import { renderEmailDraft } from "../shared/email-template";
import { normalizeResearchFields, sanitizeProfileDraft } from "../shared/profile-utils";
import { getAuthorizedGmailClient } from "./gmailActions";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";

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

function buildPrompt(args: {
  senderName: string;
  senderDegree: string;
  senderSchool: string;
  senderIntroduction: string;
  professorName: string;
  researchTitle: string;
  researchAbstract: string;
  researchField: string;
  researchFieldHighlights: string[];
  notes: string;
  goodEmailExamples: string;
}) {
  return [
    "Write one concise paragraph for a cold email to a professor.",
    `The sender is ${args.senderName}, ${args.senderDegree} at ${args.senderSchool}.`,
    args.senderIntroduction
      ? `Sender background/context: ${args.senderIntroduction}`
      : "",
    `Start naturally and mention the paper "${args.researchTitle}".`,
    `Focus on the sender's research field: ${args.researchField}.`,
    args.researchFieldHighlights.length > 0
      ? `Relevant sender highlights: ${args.researchFieldHighlights.join(" | ")}`
      : "",
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
  senderName: string;
  senderDegree: string;
  senderSchool: string;
  senderIntroduction: string;
  professorName: string;
  researchTitle: string;
  researchAbstract: string;
  researchField: string;
  researchFieldHighlights: string[];
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
  const mixedBoundary = `mixed_${Math.random().toString(36).slice(2, 12)}`;
  const altBoundary = `alt_${Math.random().toString(36).slice(2, 12)}`;

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
    researchField: v.string(),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const rawProfile = await ctx.runQuery(internal.profiles.getByUserIdInternal, {
      userId: identity.subject,
    });
    const profile = sanitizeProfileDraft(rawProfile);
    const attachments = await ctx.runQuery(internal.attachments.listByUserIdInternal, {
      userId: identity.subject,
    });
    const researchFields = normalizeResearchFields(profile.researchFields);
    const selectedField =
      researchFields.find(
        (field) =>
          field.name.trim().toLowerCase() ===
          args.researchField.trim().toLowerCase(),
      ) ?? researchFields[0];

    const generatedHook = await generateHookWithOpenAI({
      senderName: profile.fullName,
      senderDegree: profile.degree,
      senderSchool: profile.school,
      senderIntroduction: profile.introduction,
      professorName: args.professorName,
      researchTitle: args.researchTitle,
      researchAbstract: args.researchAbstract,
      researchField: selectedField?.name ?? args.researchField,
      researchFieldHighlights: selectedField?.highlights ?? [],
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

    await ctx.runAction(internal.emailsActions.sendScheduledEmail, { emailId });
    return { emailId };
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
