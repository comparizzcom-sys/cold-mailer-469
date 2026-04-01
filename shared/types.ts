export const emailStatuses = [
  "draft",
  "scheduled",
  "sending",
  "sent",
  "failed",
  "cancelled",
] as const;
export type EmailStatus = (typeof emailStatuses)[number];

export const attachmentKinds = ["cv", "transcript", "other"] as const;
export type AttachmentKind = (typeof attachmentKinds)[number];

export type ResearchFieldDraft = {
  id: string;
  name: string;
  highlights: string[];
};

export type ProfileDraft = {
  fullName: string;
  degree: string;
  school: string;
  location: string;
  phone: string;
  defaultSubject: string;
  introduction: string;
  closingText: string;
  researchFields: ResearchFieldDraft[];
  honors: string[];
  publicationBlurb: string;
  goodEmailExamples: string;
};

export type AttachmentSummary = {
  id: string;
  kind: AttachmentKind;
  fileName: string;
  storageId: string;
  contentType: string;
};

export type DraftComposeInput = {
  professorName: string;
  professorEmail: string;
  researchTitle: string;
  researchAbstract: string;
  researchField: string;
  notes: string;
  generatedHook: string;
  profile: ProfileDraft;
  attachments: AttachmentSummary[];
};
