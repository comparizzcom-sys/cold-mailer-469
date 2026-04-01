import { defaultProfile } from "./default-profile";
import { normalizeResearchFields } from "./profile-utils";
import type { AttachmentSummary, DraftComposeInput, ProfileDraft } from "./types";
import { plainTextToHtml } from "./html-email";

function normalizeProfile(profile?: Partial<ProfileDraft>): ProfileDraft {
  return {
    ...defaultProfile,
    ...profile,
    researchFields: normalizeResearchFields(profile?.researchFields),
    honors: profile?.honors ?? defaultProfile.honors,
  };
}

function getSelectedResearchField(profile: ProfileDraft, fieldName: string) {
  return (
    profile.researchFields.find(
      (field) => field.name.trim().toLowerCase() === fieldName.trim().toLowerCase(),
    ) ?? profile.researchFields[0]
  );
}

function formatAttachmentSentence(attachments: AttachmentSummary[]) {
  const labels = attachments
    .map((attachment) => {
      if (attachment.kind === "cv") return "my CV";
      if (attachment.kind === "transcript") return "my transcript";
      return attachment.fileName;
    })
    .filter(Boolean);

  if (labels.length === 0) {
    return "I would be happy to share my CV or transcript if helpful.";
  }

  if (labels.length === 1) {
    return `I have attached ${labels[0]} for reference.`;
  }

  const head = labels.slice(0, -1).join(", ");
  const tail = labels.at(-1);
  return `I have attached ${head}, and ${tail} for reference.`;
}

export function renderEmailDraft(input: DraftComposeInput) {
  const profile = normalizeProfile(input.profile);
  const selectedField = getSelectedResearchField(profile, input.researchField);
  const fieldLabel =
    selectedField?.name.trim() ||
    input.researchField.trim() ||
    "your lab's research area";
  const highlights = selectedField?.highlights ?? [];
  const professorName = input.professorName.trim() || "Professor";
  const hook = input.generatedHook.trim();
  const notes = input.notes.trim();
  const attachmentSentence = formatAttachmentSentence(input.attachments);
  const subject = profile.defaultSubject.trim() || defaultProfile.defaultSubject;

  const intro = [
    `My name is ${profile.fullName}, and I am a ${profile.degree} at ${profile.school}.`,
    profile.introduction.trim(),
  ]
    .filter(Boolean)
    .join(" ");

  const researchParagraph = hook
    ? hook
    : `I was particularly interested in your work on "${input.researchTitle.trim()}" and the way it intersects with ${fieldLabel}.`;

  const notesParagraph = notes
    ? `A few extra points that may be relevant: ${notes}`
    : "";

  const plainText = [
    `Dear Professor ${professorName},`,
    "",
    intro,
    researchParagraph,
    `My strongest relevant experience for ${fieldLabel} includes:`,
    ...highlights.map((item) => `- ${item}`),
    profile.publicationBlurb.trim(),
    ...profile.honors.map((item) => `- ${item}`),
    notesParagraph,
    attachmentSentence,
    profile.closingText.trim(),
    "",
    `${profile.fullName}`,
    `${profile.degree}`,
    profile.school,
    profile.location,
    `Phone: ${profile.phone}`,
  ]
    .filter(Boolean)
    .join("\n");

  const html = plainTextToHtml(plainText);

  return {
    subject,
    plainText,
    html,
  };
}
