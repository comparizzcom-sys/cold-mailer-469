import { defaultProfile } from "./default-profile";
import type { AttachmentSummary, DraftComposeInput, FocusArea, ProfileDraft } from "./types";
import { plainTextToHtml } from "./html-email";

const focusLabelMap: Record<FocusArea, string> = {
  cv: "Computer Vision",
  robotics: "Robotics",
  hybrid: "Robotics and Computer Vision",
};

function normalizeProfile(profile?: Partial<ProfileDraft>): ProfileDraft {
  return {
    ...defaultProfile,
    ...profile,
    cvHighlights: profile?.cvHighlights ?? defaultProfile.cvHighlights,
    roboticsHighlights:
      profile?.roboticsHighlights ?? defaultProfile.roboticsHighlights,
    hybridHighlights: profile?.hybridHighlights ?? defaultProfile.hybridHighlights,
    honors: profile?.honors ?? defaultProfile.honors,
  };
}

function getHighlights(profile: ProfileDraft, focusArea: FocusArea) {
  switch (focusArea) {
    case "cv":
      return profile.cvHighlights;
    case "robotics":
      return profile.roboticsHighlights;
    case "hybrid":
      return profile.hybridHighlights;
  }
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
  const highlights = getHighlights(profile, input.focusArea);
  const focusLabel = focusLabelMap[input.focusArea];
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
    : `I was particularly interested in your work on "${input.researchTitle.trim()}" and the way it intersects with ${focusLabel}.`;

  const notesParagraph = notes
    ? `A few extra points that may be relevant: ${notes}`
    : "";

  const plainText = [
    `Dear Professor ${professorName},`,
    "",
    intro,
    researchParagraph,
    `My strongest relevant experience for ${focusLabel} includes:`,
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
