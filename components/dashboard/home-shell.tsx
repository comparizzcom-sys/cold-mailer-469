"use client";

import Link from "next/link";
import {
  UserButton,
  useUser,
} from "@clerk/nextjs";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState, useTransition } from "react";

import { api } from "@/convex/_generated/api";
import { ResearchFieldsEditor } from "@/components/dashboard/research-fields-editor";
import { plainTextToHtml } from "@/shared/html-email";
import { defaultProfile } from "@/shared/default-profile";
import { renderEmailDraft } from "@/shared/email-template";
import {
  isProfileOnboarded,
  makeResearchField,
  normalizeResearchFields,
} from "@/shared/profile-utils";
import type { ProfileDraft } from "@/shared/types";
import { getSupportedTimezones } from "@/src/lib/timezones";
import styles from "./home-shell.module.css";

type GmailStatus = {
  connected: boolean;
  email: string | null;
  displayName: string | null;
  scopes: string[];
  connectedAt: number | null;
};

const defaultCompose = {
  professorName: "",
  professorEmail: "",
  researchTitle: "",
  researchAbstract: "",
  researchField: defaultProfile.researchFields[0]?.name ?? "",
  notes: "",
};

function formatDateTime(value?: number | null) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export function HomeShell() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { user } = useUser();
  const queryArgs = isAuthenticated ? {} : "skip";

  const profile = useQuery(api.profiles.getForCurrentUser, queryArgs) as
    | (ProfileDraft & { userId?: string })
    | undefined;
  const gmailStatus = useQuery(api.gmail.getStatus, queryArgs) as GmailStatus | undefined;
  const attachments = (useQuery(api.attachments.list, queryArgs) ?? []) as Array<any>;
  const scheduled = (useQuery(api.emails.listScheduled, queryArgs) ?? []) as Array<any>;
  const recent = (useQuery(api.emails.listRecent, queryArgs) ?? []) as Array<any>;

  const saveProfile = useMutation(api.profiles.upsert);
  const generateUploadUrl = useMutation(api.attachments.generateUploadUrl);
  const saveAttachment = useMutation(api.attachments.saveMetadata);
  const disconnectGmail = useMutation(api.gmail.disconnect);
  const generateDraft = useAction(api.emailsActions.generateDraft);
  const sendNow = useAction(api.emailsActions.sendNow);
  const scheduleEmail = useMutation(api.emails.schedule);

  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(defaultProfile);
  const [profileHydrated, setProfileHydrated] = useState(false);
  const [compose, setCompose] = useState(defaultCompose);
  const [draftText, setDraftText] = useState("");
  const [draftSubject, setDraftSubject] = useState(defaultProfile.defaultSubject);
  const [generatedHook, setGeneratedHook] = useState("");
  const [scheduledLocalAt, setScheduledLocalAt] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [attachmentKind, setAttachmentKind] = useState<"cv" | "transcript" | "other">(
    "cv",
  );
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [message, setMessage] = useState<{
    type: "info" | "success" | "error";
    text: string;
  } | null>(null);
  const [isSavingProfile, startSavingProfile] = useTransition();
  const [isUploading, startUploading] = useTransition();
  const [isGenerating, startGenerating] = useTransition();
  const [isScheduling, startScheduling] = useTransition();
  const [isSending, startSending] = useTransition();

  useEffect(() => {
    if (profile && !profileHydrated) {
      const clerkFullName = [user?.firstName, user?.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      const defaultName = defaultProfile.fullName;
      const resolvedName =
        profile.fullName && profile.fullName !== defaultName
          ? profile.fullName
          : clerkFullName || profile.fullName || defaultName;
      const researchFields = normalizeResearchFields(profile.researchFields);

      setProfileDraft({
        fullName: resolvedName,
        degree: profile.degree ?? defaultProfile.degree,
        school: profile.school ?? defaultProfile.school,
        location: profile.location ?? defaultProfile.location,
        phone: profile.phone ?? defaultProfile.phone,
        defaultSubject: profile.defaultSubject ?? defaultProfile.defaultSubject,
        introduction: profile.introduction ?? defaultProfile.introduction,
        closingText: profile.closingText ?? defaultProfile.closingText,
        researchFields,
        honors: profile.honors ?? defaultProfile.honors,
        publicationBlurb:
          profile.publicationBlurb ?? defaultProfile.publicationBlurb,
        goodEmailExamples:
          profile.goodEmailExamples ?? defaultProfile.goodEmailExamples,
      });
      setCompose((current) => ({
        ...current,
        researchField: researchFields[0]?.name ?? current.researchField,
      }));
      setDraftSubject(profile.defaultSubject ?? defaultProfile.defaultSubject);
      setProfileHydrated(true);
    }
  }, [profile, profileHydrated, user?.firstName, user?.lastName]);

  useEffect(() => {
    if (profileHydrated && profile && !isProfileOnboarded(profile)) {
      router.replace("/onboarding");
    }
  }, [profile, profileHydrated, router]);

  const timezoneOptions = getSupportedTimezones();
  const researchFieldOptions = normalizeResearchFields(profileDraft.researchFields).filter(
    (field) => field.name.trim(),
  );
  const statScheduled = scheduled.length;
  const statSent = recent.filter((item) => item.status === "sent").length;
  const statFailed = recent.filter((item) => item.status === "failed").length;

  if (isLoading) {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>Loading workspace</h2>
                <p>Waiting for your Clerk session to be validated with Convex.</p>
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
                <p>
                  You are signed into Clerk, but Convex has not accepted the session
                  token yet. Check the Clerk Convex integration, JWT issuer domain,
                  and the `convex` JWT template in Clerk.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  async function handleSaveProfile() {
    startSavingProfile(async () => {
      try {
        await saveProfile({
          ...profileDraft,
          researchFields: researchFieldOptions,
        });
        setMessage({ type: "success", text: "Profile saved to Convex." });
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

  async function handleGenerateDraft() {
    if (!compose.researchField) {
      setMessage({
        type: "error",
        text: "Add at least one research field before generating a draft.",
      });
      return;
    }

    startGenerating(async () => {
      try {
        const result = await generateDraft(compose);
        setDraftText(result.plainText);
        setDraftSubject(result.subject);
        setGeneratedHook(result.generatedHook);
        setMessage({
          type: "success",
          text: "Draft generated. You can edit it before sending.",
        });
      } catch (error) {
        setMessage({
          type: "error",
          text: error instanceof Error ? error.message : "Failed to generate draft.",
        });
      }
    });
  }

  async function handleSendNow() {
    startSending(async () => {
      try {
        await sendNow({
          ...compose,
          generatedHook,
          plainText: draftText,
          html: plainTextToHtml(draftText),
          subject: draftSubject,
        });
        setMessage({
          type: "success",
          text: "Email sent or queued for immediate send.",
        });
      } catch (error) {
        setMessage({
          type: "error",
          text: error instanceof Error ? error.message : "Failed to send email.",
        });
      }
    });
  }

  async function handleSchedule() {
    if (!scheduledLocalAt) {
      setMessage({ type: "error", text: "Choose a date and time first." });
      return;
    }

    startScheduling(async () => {
      try {
        await scheduleEmail({
          ...compose,
          generatedHook,
          plainText: draftText,
          html: plainTextToHtml(draftText),
          subject: draftSubject,
          scheduledLocalAt,
          timezone,
        });
        setMessage({ type: "success", text: "Email scheduled successfully." });
      } catch (error) {
        setMessage({
          type: "error",
          text: error instanceof Error ? error.message : "Failed to schedule email.",
        });
      }
    });
  }

  async function handleDisconnectGmail() {
    startTransition(async () => {
      try {
        await disconnectGmail({});
        setMessage({ type: "success", text: "Disconnected Gmail." });
      } catch (error) {
        setMessage({
          type: "error",
          text: error instanceof Error ? error.message : "Failed to disconnect Gmail.",
        });
      }
    });
  }

  const previewHtml = draftText
    ? plainTextToHtml(draftText)
    : renderEmailDraft({
        ...compose,
        generatedHook,
        profile: profileDraft,
        attachments: attachments.map((attachment) => ({
          id: attachment._id,
          kind: attachment.kind,
          fileName: attachment.fileName,
          storageId: attachment.storageId,
          contentType: attachment.contentType,
        })),
      }).html;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>Convex + Gmail + OpenAI</span>
            <h1 className={styles.title}>Cold Mailer 469</h1>
            <p className={styles.lead}>
              Each signed-in user manages their own research fields, mailbox, and
              profile context. Drafts stay editable, and the final email HTML is
              rendered consistently before sending or scheduling.
            </p>
          </div>

          <div className={styles.heroPanel}>
            <div>
              <span>Scheduled</span>
              <strong>{statScheduled}</strong>
            </div>
            <div>
              <span>Sent</span>
              <strong>{statSent}</strong>
            </div>
            <div>
              <span>Failed</span>
              <strong>{statFailed}</strong>
            </div>
            <div>
              <span>Session</span>
              <strong>
                <UserButton afterSignOutUrl="/sign-up" />
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
                      : message.type === "error"
                        ? styles.messageError
                        : ""
                  }`}
                >
                  {message.text}
                </div>
              ) : null}

              <section className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h2>Compose</h2>
                    <p>
                      Generate a tailored research-intro paragraph, then edit the
                      full draft before sending.
                    </p>
                  </div>
                </div>
                <div className={styles.formGrid}>
                  <div className={styles.field}>
                    <label>Professor name</label>
                    <input
                      className={styles.input}
                      value={compose.professorName}
                      onChange={(event) =>
                        setCompose((current) => ({
                          ...current,
                          professorName: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className={styles.field}>
                    <label>Professor email</label>
                    <input
                      className={styles.input}
                      type="email"
                      value={compose.professorEmail}
                      onChange={(event) =>
                        setCompose((current) => ({
                          ...current,
                          professorEmail: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className={`${styles.field} ${styles.fieldWide}`}>
                    <label>Research title</label>
                    <input
                      className={styles.input}
                      value={compose.researchTitle}
                      onChange={(event) =>
                        setCompose((current) => ({
                          ...current,
                          researchTitle: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className={`${styles.field} ${styles.fieldWide}`}>
                    <label>Research abstract</label>
                    <textarea
                      className={styles.textarea}
                      value={compose.researchAbstract}
                      onChange={(event) =>
                        setCompose((current) => ({
                          ...current,
                          researchAbstract: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className={styles.field}>
                    <label>Research field</label>
                    <select
                      className={styles.select}
                      value={compose.researchField}
                      onChange={(event) =>
                        setCompose((current) => ({
                          ...current,
                          researchField: event.target.value,
                        }))
                      }
                    >
                      {researchFieldOptions.map((field) => (
                        <option key={field.id} value={field.name}>
                          {field.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label>Timezone</label>
                    <select
                      className={styles.select}
                      value={timezone}
                      onChange={(event) => setTimezone(event.target.value)}
                    >
                      {timezoneOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={`${styles.field} ${styles.fieldWide}`}>
                    <label>Additional comments</label>
                    <textarea
                      className={styles.textarea}
                      value={compose.notes}
                      onChange={(event) =>
                        setCompose((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className={styles.buttonRow}>
                  <button
                    className={styles.button}
                    onClick={handleGenerateDraft}
                    disabled={isGenerating}
                  >
                    {isGenerating ? "Generating..." : "Generate draft"}
                  </button>
                </div>

                <div className={styles.formGrid}>
                  <div className={`${styles.field} ${styles.fieldWide}`}>
                    <label>Subject</label>
                    <input
                      className={styles.input}
                      value={draftSubject}
                      onChange={(event) => setDraftSubject(event.target.value)}
                    />
                  </div>
                  <div className={`${styles.field} ${styles.fieldWide}`}>
                    <label>Editable draft</label>
                    <textarea
                      className={`${styles.textarea} ${styles.draftArea}`}
                      value={draftText}
                      onChange={(event) => setDraftText(event.target.value)}
                    />
                  </div>
                  <div className={styles.field}>
                    <label>Schedule date and time</label>
                    <input
                      className={styles.input}
                      type="datetime-local"
                      value={scheduledLocalAt}
                      onChange={(event) => setScheduledLocalAt(event.target.value)}
                    />
                  </div>
                </div>

                <div className={styles.buttonRow}>
                  <button
                    className={styles.buttonGhost}
                    onClick={handleSendNow}
                    disabled={isSending}
                  >
                    {isSending ? "Sending..." : "Send now"}
                  </button>
                  <button
                    className={styles.button}
                    onClick={handleSchedule}
                    disabled={isScheduling}
                  >
                    {isScheduling ? "Scheduling..." : "Schedule email"}
                  </button>
                </div>
              </section>

              <section className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h2>Rendered preview</h2>
                    <p>This is the HTML body that will be sent from Gmail.</p>
                  </div>
                </div>
                <div
                  className={styles.listItem}
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </section>
            </div>

            <div className={styles.column}>
              <section className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h3>Gmail connection</h3>
                    <p>
                      OAuth is separate from your app login so each user sends
                      from their own mailbox.
                    </p>
                  </div>
                  <span
                    className={`${styles.statusPill} ${
                      gmailStatus?.connected
                        ? styles.statusConnected
                        : styles.statusFailed
                    }`}
                  >
                    {gmailStatus?.connected ? "Connected" : "Not connected"}
                  </span>
                </div>
                <div className={styles.list}>
                  <div className={styles.listItem}>
                    <strong>Sender mailbox</strong>
                    <span className={styles.muted}>
                      {gmailStatus?.email ?? "No Gmail account connected yet."}
                    </span>
                  </div>
                </div>
                <div className={styles.buttonRow}>
                  <Link href="/api/gmail/connect" className={styles.button}>
                    Connect Gmail
                  </Link>
                  <button
                    className={styles.buttonDanger}
                    onClick={handleDisconnectGmail}
                  >
                    Disconnect
                  </button>
                </div>
              </section>

              <section className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h3>Profile settings</h3>
                    <p>
                      Everything that used to be hardcoded in Python now lives
                      here.
                    </p>
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
                    <p>
                      Manage the exact research-field options available in the
                      compose dropdown for this user.
                    </p>
                  </div>
                </div>
                <ResearchFieldsEditor
                  fields={
                    profileDraft.researchFields.length > 0
                      ? profileDraft.researchFields
                      : [makeResearchField("")]
                  }
                  onChange={(researchFields) => {
                    setProfileDraft((current) => ({ ...current, researchFields }));
                    const firstNamedField = researchFields.find((field) => field.name.trim());
                    if (firstNamedField) {
                      setCompose((current) => ({
                        ...current,
                        researchField:
                          current.researchField && researchFields.some(
                            (field) => field.name === current.researchField,
                          )
                            ? current.researchField
                            : firstNamedField.name,
                      }));
                    }
                  }}
                />
              </section>

              <section className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h3>Additional profile context</h3>
                    <p>
                      These shape the prompt, signature, and final deterministic
                      email body.
                    </p>
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
                    <p>
                      Upload your CV, transcript, and any optional supporting
                      files.
                    </p>
                  </div>
                </div>
                <div className={styles.uploadRow}>
                  <select
                    className={styles.select}
                    value={attachmentKind}
                    onChange={(event) =>
                      setAttachmentKind(
                        event.target.value as "cv" | "transcript" | "other",
                      )
                    }
                  >
                    <option value="cv">CV</option>
                    <option value="transcript">Transcript</option>
                    <option value="other">Other</option>
                  </select>
                  <input
                    className={styles.input}
                    type="file"
                    onChange={(event) =>
                      setAttachmentFile(event.target.files?.[0] ?? null)
                    }
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
                      <span className={styles.muted}>
                        No attachments uploaded yet.
                      </span>
                    </div>
                  ) : (
                    attachments.map((attachment) => (
                      <div key={attachment._id} className={styles.listItem}>
                        <strong>{attachment.fileName}</strong>
                        <span className={styles.muted}>
                          {attachment.kind.toUpperCase()} .{" "}
                          {(attachment.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h3>Scheduled emails</h3>
                    <p>Convex keeps these queued with per-email jobs.</p>
                  </div>
                </div>
                <div className={styles.list}>
                  {scheduled.length === 0 ? (
                    <div className={styles.listItem}>
                      <span className={styles.muted}>
                        No scheduled emails yet.
                      </span>
                    </div>
                  ) : (
                    [...scheduled]
                      .sort(
                        (left, right) =>
                          (left.scheduledForUtcMs ?? 0) -
                          (right.scheduledForUtcMs ?? 0),
                      )
                      .map((email) => (
                        <div key={email._id} className={styles.listItem}>
                          <strong>{email.professorName}</strong>
                          <span className={styles.muted}>
                            {email.professorEmail}
                          </span>
                          <br />
                          <span className={styles.muted}>
                            {formatDateTime(email.scheduledForUtcMs)}
                          </span>
                        </div>
                      ))
                  )}
                </div>
              </section>

              <section className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h3>Recent activity</h3>
                    <p>Sent and failed deliveries stay visible for review.</p>
                  </div>
                </div>
                <div className={styles.list}>
                  {recent.length === 0 ? (
                    <div className={styles.listItem}>
                      <span className={styles.muted}>No email history yet.</span>
                    </div>
                  ) : (
                    recent.map((email) => (
                      <div key={email._id} className={styles.listItem}>
                        <div className={styles.inline}>
                          <strong>{email.professorName}</strong>
                          <span
                            className={`${styles.statusPill} ${
                              email.status === "sent"
                                ? styles.statusConnected
                                : email.status === "failed"
                                  ? styles.statusFailed
                                  : ""
                            }`}
                          >
                            {email.status}
                          </span>
                        </div>
                        <span className={styles.muted}>
                          {email.professorEmail}
                        </span>
                        <br />
                        <span className={styles.muted}>
                          {email.sentAtMs
                            ? formatDateTime(email.sentAtMs)
                            : formatDateTime(email.createdAt)}
                        </span>
                        {email.failureReason ? (
                          <>
                            <br />
                            <span className={styles.muted}>
                              {email.failureReason}
                            </span>
                          </>
                        ) : null}
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
