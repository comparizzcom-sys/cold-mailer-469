"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useUser } from "@clerk/nextjs";

import { api } from "@/convex/_generated/api";
import { defaultProfile } from "@/shared/default-profile";
import { isProfileOnboarded, makeResearchField, normalizeResearchFields } from "@/shared/profile-utils";
import type { ProfileDraft } from "@/shared/types";
import { ResearchFieldsEditor } from "./research-fields-editor";
import styles from "./onboarding.module.css";

export function OnboardingForm() {
  const router = useRouter();
  const { user } = useUser();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const profile = useQuery(api.profiles.getForCurrentUser, isAuthenticated ? {} : "skip") as
    | (ProfileDraft & { userId?: string })
    | undefined;
  const saveProfile = useMutation(api.profiles.upsert);
  const [draft, setDraft] = useState<ProfileDraft>(defaultProfile);
  const [hydrated, setHydrated] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  if (isLoading) {
    return (
      <main className={styles.page}>
        <section className={styles.panel}>
          <div className={styles.header}>
            <h1>Loading onboarding</h1>
            <p>Waiting for your Convex session to be ready.</p>
          </div>
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className={styles.page}>
        <section className={styles.panel}>
          <div className={styles.header}>
            <h1>Convex authentication not ready</h1>
            <p>
              Clerk sign-in succeeded, but Convex does not yet recognize the
              session. Check your Clerk Convex integration and JWT issuer setup.
            </p>
          </div>
        </section>
      </main>
    );
  }

  useEffect(() => {
    if (!profile || hydrated) return;

    const clerkName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
    setDraft({
      fullName: clerkName || profile.fullName || defaultProfile.fullName,
      degree: profile.degree ?? defaultProfile.degree,
      school: profile.school ?? defaultProfile.school,
      location: profile.location ?? defaultProfile.location,
      phone: profile.phone ?? defaultProfile.phone,
      defaultSubject: profile.defaultSubject ?? defaultProfile.defaultSubject,
      introduction: profile.introduction ?? defaultProfile.introduction,
      closingText: profile.closingText ?? defaultProfile.closingText,
      researchFields: normalizeResearchFields(profile.researchFields),
      honors: profile.honors ?? defaultProfile.honors,
      publicationBlurb: profile.publicationBlurb ?? defaultProfile.publicationBlurb,
      goodEmailExamples: profile.goodEmailExamples ?? defaultProfile.goodEmailExamples,
    });
    setHydrated(true);
  }, [hydrated, profile, user?.firstName, user?.lastName]);

  useEffect(() => {
    if (profile && hydrated && isProfileOnboarded(profile)) {
      router.replace("/");
    }
  }, [hydrated, profile, router]);

  function handleSubmit() {
    startSaving(async () => {
      const normalizedFields = normalizeResearchFields(draft.researchFields).filter(
        (field) => field.name.trim(),
      );

      if (normalizedFields.length === 0) {
        setMessage("Add at least one research field before continuing.");
        return;
      }

      try {
        await saveProfile({
          ...draft,
          researchFields: normalizedFields,
        });
        router.push("/");
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Failed to save onboarding info.",
        );
      }
    });
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.header}>
          <h1>Set up your research profile</h1>
          <p>
            Add your name and research fields first. These fields will populate the
            compose dropdown for this user and can be edited later.
          </p>
        </div>

        {message ? <div className={`${styles.message} ${styles.error}`}>{message}</div> : null}

        <div className={styles.grid}>
          <div className={styles.field}>
            <label>Full name</label>
            <input
              className={styles.input}
              value={draft.fullName}
              onChange={(event) =>
                setDraft((current) => ({ ...current, fullName: event.target.value }))
              }
            />
          </div>
          <div className={styles.field}>
            <label>Default subject</label>
            <input
              className={styles.input}
              value={draft.defaultSubject}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  defaultSubject: event.target.value,
                }))
              }
            />
          </div>
          <div className={styles.field}>
            <label>Degree / headline</label>
            <input
              className={styles.input}
              value={draft.degree}
              onChange={(event) =>
                setDraft((current) => ({ ...current, degree: event.target.value }))
              }
            />
          </div>
          <div className={styles.field}>
            <label>School</label>
            <input
              className={styles.input}
              value={draft.school}
              onChange={(event) =>
                setDraft((current) => ({ ...current, school: event.target.value }))
              }
            />
          </div>
          <div className={`${styles.field} ${styles.wide}`}>
            <label>Introduction</label>
            <textarea
              className={styles.textarea}
              value={draft.introduction}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  introduction: event.target.value,
                }))
              }
            />
          </div>
        </div>

        <ResearchFieldsEditor
          fields={draft.researchFields.length > 0 ? draft.researchFields : [makeResearchField("")]}
          onChange={(researchFields) =>
            setDraft((current) => ({ ...current, researchFields }))
          }
        />

        <div className={styles.buttonRow}>
          <button className={styles.button} type="button" onClick={handleSubmit}>
            {isSaving ? "Saving..." : "Continue to mailing"}
          </button>
        </div>
      </section>
    </main>
  );
}
