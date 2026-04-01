import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  profiles: defineTable({
    userId: v.string(),
    fullName: v.string(),
    degree: v.string(),
    school: v.string(),
    location: v.string(),
    phone: v.string(),
    defaultSubject: v.string(),
    introduction: v.string(),
    closingText: v.string(),
    researchFields: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        highlights: v.array(v.string()),
      }),
    ),
    honors: v.array(v.string()),
    publicationBlurb: v.string(),
    goodEmailExamples: v.string(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  attachments: defineTable({
    userId: v.string(),
    kind: v.union(v.literal("cv"), v.literal("transcript"), v.literal("other")),
    fileName: v.string(),
    contentType: v.string(),
    storageId: v.id("_storage"),
    size: v.number(),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_kind", ["userId", "kind"]),

  gmailAccounts: defineTable({
    userId: v.string(),
    email: v.string(),
    displayName: v.optional(v.string()),
    encryptedRefreshToken: v.string(),
    scopes: v.array(v.string()),
    tokenType: v.optional(v.string()),
    expiryDate: v.optional(v.number()),
    isConnected: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  emails: defineTable({
    userId: v.string(),
    professorName: v.string(),
    professorEmail: v.string(),
    researchTitle: v.string(),
    researchAbstract: v.string(),
    researchField: v.string(),
    notes: v.string(),
    generatedHook: v.string(),
    subject: v.string(),
    html: v.string(),
    plainText: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("scheduled"),
      v.literal("sending"),
      v.literal("sent"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
    failureReason: v.optional(v.string()),
    gmailMessageId: v.optional(v.string()),
    scheduledForUtcMs: v.optional(v.number()),
    scheduledTimezone: v.optional(v.string()),
    scheduledJobId: v.optional(v.string()),
    sentAtMs: v.optional(v.number()),
    attachmentIds: v.array(v.id("attachments")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_status", ["userId", "status"])
    .index("by_userId_createdAt", ["userId", "createdAt"])
    .index("by_userId_scheduledForUtcMs", ["userId", "scheduledForUtcMs"]),
});
