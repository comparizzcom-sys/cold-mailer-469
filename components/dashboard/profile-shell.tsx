"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { api } from "@/convex/_generated/api";
import { ResearchFieldsEditor } from "@/components/dashboard/research-fields-editor";
import { defaultProfile } from "@/shared/default-profile";
import {
  isLegacySeededProfile,
  makeResearchField,
  normalizeResearchFields,
} from "@/shared/profile-utils";
import type { ProfileDraft } from "@/shared/types";
import { useGmailStatus } from "@/src/hooks/use-gmail-status";
import styles from "./home-shell.module.css";

export function ProfileShell() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { user } = useUser();
  const searchParams = useSearchParams();
  const { gmailStatus, gmailStatusLoading } = useGmailStatus();
  const queryArgs = isAuthenticated ? {} : "skip";

  const profile = useQuery(api.profiles.getForCurrentUser, queryArgs) as
    | (ProfileDraft & { userId?: string })
    | undefined;
  const attachments = (useQuery(api.attachments.list, queryArgs) ?? []) as Array<any>;

  const saveProfile = useMutation(api.profiles.upsert);
  const generateUploadUrl = useMutation(api.attachments.generateUploadUrl);
  const saveAttachment = useMutation(api.attachments.saveMetadata);
  const removeAttachment = useMutation(api.attachments.remove);

  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(defaultProfile);
  const [profileHydrated, setProfileHydrated] = useState(false);
  const [attachmentKind, setAttachmentKind] = useState<"cv" | "transcript" | "other">(
    "cv",
  );
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isSavingProfile, startSavingProfile] = useTransition();
  const [isUploading, startUploading] = useTransition();
  const [isRemovingAttachment, startRemovingAttachment] = useTransition();

  useEffect(() => {
    if (!profile || profileHydrated) return;

    const clerkFullName = [user?.firstName, user?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    const shouldTreatAsBlank =
      !profile.fullName?.trim() || isLegacySeededProfile(profile);
    const researchFields = normalizeResearchFields(profile.researchFields);

    setProfileDraft({
      fullName: shouldTreatAsBlank ? clerkFullName : profile.fullName || clerkFullName,
      degree: shouldTreatAsBlank ? "" : profile.degree ?? "",
      school: shouldTreatAsBlank ? "" : profile.school ?? "",
      location: shouldTreatAsBlank ? "" : profile.location ?? "",
      phone: shouldTreatAsBlank ? "" : profile.phone ?? "",
      defaultSubject: shouldTreatAsBlank ? "" : profile.defaultSubject ?? "",
      introduction: shouldTreatAsBlank ? "" : profile.introduction ?? "",
      closingText: shouldTreatAsBlank ? "" : profile.closingText ?? "",
      researchFields,
      honors: shouldTreatAsBlank ? [] : profile.honors ?? [],
      publicationBlurb: shouldTreatAsBlank ? "" : profile.publicationBlurb ?? "",
      goodEmailExamples: shouldTreatAsBlank ? "" : profile.goodEmailExamples ?? "",
    });
    setProfileHydrated(true);
  }, [profile, profileHydrated, user?.firstName, user?.lastName]);

  useEffect(() => {
    const gmailMessage = searchParams.get("gmail");
    if (!gmailMessage) return;

    setMessage({
      type: "success",
      text:
        gmailMessage === "managed-by-clerk"
          ? "Google mail access is now managed by your Clerk Google sign-in. If you recently added the Gmail scope, sign out and sign back in once."
          : `Google mail note: ${gmailMessage}`,
    });
  }, [searchParams]);

  async function handleSaveProfile() {
    startSavingProfile(async () => {
      try {
        await saveProfile({
          ...profileDraft,
          researchFields: normalizeResearchFields(profileDraft.researchFields).filter((field) =>
            field.name.trim(),
          ),
        });
        setMessage({ type: "success", text: "Profile saved." });
      } catch (error) {
        setMessage({
          type: "error",
          text: error instanceof Error ? error.message : "Failed to save profile.",
        });
      }
    });
  }

  async function handleUploadAttachment() {
    if (!attachmentFile) {
      setMessage({ type: "error", text: "Choose a file before uploading." });
      return;
    }

    startUploading(async () => {
      try {
        const uploadUrl = await generateUploadUrl({});
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "Content-Type": attachmentFile.type || "application/octet-stream",
          },
          body: attachmentFile,
        });

        const { storageId } = await result.json();
        await saveAttachment({
          kind: attachmentKind,
          fileName: attachmentFile.name,
          contentType: attachmentFile.type || "application/octet-stream",
          storageId,
          size: attachmentFile.size,
        });

        setAttachmentFile(null);
        setMessage({ type: "success", text: `${attachmentFile.name} uploaded.` });
      } catch (error) {
        setMessage({
          type: "error",
          text: error instanceof Error ? error.message : "Failed to upload file.",
        });
      }
    });
  }

  async function handleRemoveAttachment(attachmentId: string, fileName: string) {
    startRemovingAttachment(async () => {
      try {
        await removeAttachment({
          attachmentId: attachmentId as any,
        });
        setMessage({ type: "success", text: `${fileName} deleted.` });
      } catch (error) {
        setMessage({
          type: "error",
          text: error instanceof Error ? error.message : "Failed to delete file.",
        });
      }
    });
  }

  if (isLoading) {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>Loading profile</h2>
                <p>Waiting for your Convex session to be ready.</p>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>Convex authentication not ready</h2>
                <p>Sign in again once the Clerk Convex integration is active.</p>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>Profile</span>
            <h1 className={styles.title}>Your Profile and Documents</h1>
            <p className={styles.lead}>
              Manage the research fields, signature, examples, and documents that
              power every generated mail.
            </p>
          </div>
          <div className={styles.heroPanel}>
            <div>
              <span>Google mail</span>
              <strong>
                {gmailStatusLoading
                  ? "Checking..."
                  : gmailStatus.connected
                    ? "Ready"
                    : "Needs Google sign-in"}
              </strong>
            </div>
            <div>
              <span>Sender</span>
              <strong>{gmailStatus.email ?? "Unavailable"}</strong>
            </div>
            <div>
              <span>Workspace</span>
              <strong>
                <Link href="/" className={styles.buttonGhost}>
                  Back to mailing
                </Link>
              </strong>
            </div>
          </div>
        </section>

        <div className={styles.grid}>
          <div className={styles.column}>
            {message ? (
              <div
                className={`${styles.message} ${
                  message.type === "success"
                    ? styles.messageSuccess
                    : styles.messageError
                }`}
              >
                {message.text}
              </div>
            ) : null}

            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h3>Mail permissions</h3>
                  <p>
                    Gmail sending now comes from your Clerk Google sign-in token.
                    No separate connect step is required.
                  </p>
                </div>
                <span
                  className={`${styles.statusPill} ${
                    gmailStatus.connected ? styles.statusConnected : styles.statusFailed
                  }`}
                >
                  {gmailStatus.connected ? "Connected" : "Missing scope"}
                </span>
              </div>
              <div className={styles.list}>
                <div className={styles.listItem}>
                  <strong>Google account</strong>
                  <span className={styles.muted}>{gmailStatus.email ?? "Not available"}</span>
                </div>
                {gmailStatus.failureReason ? (
                  <div className={styles.listItem}>
                    <strong>Issue</strong>
                    <span className={styles.muted}>{gmailStatus.failureReason}</span>
                  </div>
                ) : null}
                <div className={styles.listItem}>
                  <strong>If permissions were added later</strong>
                  <span className={styles.muted}>
                    Sign out, sign back in with Google, and approve the Gmail-send
                    consent screen once so Clerk refreshes the provider token with the
                    new scope.
                  </span>
                </div>
              </div>
            </section>

            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h3>Profile settings</h3>
                  <p>Everything used in generated drafts and signatures lives here.</p>
                </div>
              </div>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label>Full name</label>
                  <input
                    className={styles.input}
                    value={profileDraft.fullName}
                    onChange={(event) =>
                      setProfileDraft((current) => ({
                        ...current,
                        fullName: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className={styles.field}>
                  <label>Phone</label>
                  <input
                    className={styles.input}
                    value={profileDraft.phone}
                    onChange={(event) =>
                      setProfileDraft((current) => ({
                        ...current,
                        phone: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className={`${styles.field} ${styles.fieldWide}`}>
                  <label>Degree / headline</label>
                  <input
                    className={styles.input}
                    value={profileDraft.degree}
                    onChange={(event) =>
                      setProfileDraft((current) => ({
                        ...current,
                        degree: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className={`${styles.field} ${styles.fieldWide}`}>
                  <label>School</label>
                  <input
                    className={styles.input}
                    value={profileDraft.school}
                    onChange={(event) =>
                      setProfileDraft((current) => ({
                        ...current,
                        school: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className={`${styles.field} ${styles.fieldWide}`}>
                  <label>Location</label>
                  <input
                    className={styles.input}
                    value={profileDraft.location}
                    onChange={(event) =>
                      setProfileDraft((current) => ({
                        ...current,
                        location: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className={`${styles.field} ${styles.fieldWide}`}>
                  <label>Default subject</label>
                  <input
                    className={styles.input}
                    value={profileDraft.defaultSubject}
                    onChange={(event) =>
                      setProfileDraft((current) => ({
                        ...current,
                        defaultSubject: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className={`${styles.field} ${styles.fieldWide}`}>
                  <label>Introduction</label>
                  <textarea
                    className={styles.textarea}
                    value={profileDraft.introduction}
                    onChange={(event) =>
                      setProfileDraft((current) => ({
                        ...current,
                        introduction: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className={`${styles.field} ${styles.fieldWide}`}>
                  <label>Closing text</label>
                  <textarea
                    className={styles.textarea}
                    value={profileDraft.closingText}
                    onChange={(event) =>
                      setProfileDraft((current) => ({
                        ...current,
                        closingText: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className={styles.buttonRow}>
                <button
                  className={styles.button}
                  onClick={handleSaveProfile}
                  disabled={isSavingProfile}
                >
                  {isSavingProfile ? "Saving..." : "Save profile"}
                </button>
              </div>
            </section>

            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h3>Research fields</h3>
                  <p>These power the research field dropdown on the mailing page.</p>
                </div>
              </div>
              <ResearchFieldsEditor
                fields={
                  profileDraft.researchFields.length > 0
                    ? profileDraft.researchFields
                    : [makeResearchField("")]
                }
                onChange={(researchFields) =>
                  setProfileDraft((current) => ({ ...current, researchFields }))
                }
              />
            </section>
          </div>

          <div className={styles.column}>
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h3>Additional profile context</h3>
                  <p>These shape the prompt and final deterministic email body.</p>
                </div>
              </div>
              <div className={styles.formGrid}>
                <div className={`${styles.field} ${styles.fieldWide}`}>
                  <label>Honors and publication blurbs (one per line)</label>
                  <textarea
                    className={styles.textarea}
                    value={profileDraft.honors.join("\n")}
                    onChange={(event) =>
                      setProfileDraft((current) => ({
                        ...current,
                        honors: event.target.value
                          .split("\n")
                          .map((item) => item.trim())
                          .filter(Boolean),
                      }))
                    }
                  />
                </div>
                <div className={`${styles.field} ${styles.fieldWide}`}>
                  <label>Publication summary</label>
                  <textarea
                    className={styles.textarea}
                    value={profileDraft.publicationBlurb}
                    onChange={(event) =>
                      setProfileDraft((current) => ({
                        ...current,
                        publicationBlurb: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className={`${styles.field} ${styles.fieldWide}`}>
                  <label>Good email examples or style notes</label>
                  <textarea
                    className={styles.textarea}
                    value={profileDraft.goodEmailExamples}
                    onChange={(event) =>
                      setProfileDraft((current) => ({
                        ...current,
                        goodEmailExamples: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </section>

            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h3>Attachments</h3>
                  <p>Upload, replace, or delete your CV, transcript, and extras.</p>
                </div>
              </div>
              <div className={styles.uploadRow}>
                <select
                  className={styles.select}
                  value={attachmentKind}
                  onChange={(event) =>
                    setAttachmentKind(event.target.value as "cv" | "transcript" | "other")
                  }
                >
                  <option value="cv">CV</option>
                  <option value="transcript">Transcript</option>
                  <option value="other">Other</option>
                </select>
                <input
                  className={styles.input}
                  type="file"
                  onChange={(event) => setAttachmentFile(event.target.files?.[0] ?? null)}
                />
                <button
                  className={styles.button}
                  onClick={handleUploadAttachment}
                  disabled={isUploading}
                >
                  {isUploading ? "Uploading..." : "Upload"}
                </button>
              </div>
              <div className={styles.list}>
                {attachments.length === 0 ? (
                  <div className={styles.listItem}>
                    <span className={styles.muted}>No attachments uploaded yet.</span>
                  </div>
                ) : (
                  attachments.map((attachment) => (
                    <div key={attachment._id} className={styles.listItem}>
                      <div className={styles.inline}>
                        <strong>{attachment.fileName}</strong>
                        <button
                          type="button"
                          className={styles.buttonDanger}
                          onClick={() =>
                            handleRemoveAttachment(String(attachment._id), attachment.fileName)
                          }
                          disabled={isRemovingAttachment}
                        >
                          Delete
                        </button>
                      </div>
                      <span className={styles.muted}>
                        {attachment.kind.toUpperCase()} . {(attachment.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
