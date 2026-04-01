import { defaultProfile } from "./default-profile";
import type { ProfileDraft, ResearchFieldDraft } from "./types";

export function slugifyResearchField(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "research-field";
}

export function makeResearchField(name = ""): ResearchFieldDraft {
  const normalized = name.trim();
  return {
    id: slugifyResearchField(normalized || `field-${Date.now()}`),
    name: normalized,
    highlights: [],
  };
}

export function normalizeResearchFields(
  fields?: ResearchFieldDraft[],
): ResearchFieldDraft[] {
  const base = fields && fields.length > 0 ? fields : defaultProfile.researchFields;
  return base.map((field, index) => ({
    id: field.id?.trim() || `${slugifyResearchField(field.name)}-${index + 1}`,
    name: field.name,
    highlights: field.highlights ?? [],
  }));
}

export function isProfileOnboarded(profile?: Partial<ProfileDraft> | null) {
  if (!profile) return false;
  if (typeof (profile as { updatedAt?: unknown }).updatedAt !== "number") {
    return false;
  }
  const nameOk = Boolean(profile.fullName?.trim());
  const introOk = Boolean(profile.introduction?.trim());
  const fieldsOk = (profile.researchFields ?? []).some((field) => field.name.trim());
  return nameOk && introOk && fieldsOk;
}
