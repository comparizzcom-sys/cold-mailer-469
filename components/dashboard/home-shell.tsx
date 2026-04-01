"use client";

import Link from "next/link";
import { UserButton, useUser } from "@clerk/nextjs";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { api } from "@/convex/_generated/api";
import { plainTextToHtml } from "@/shared/html-email";
import { defaultProfile } from "@/shared/default-profile";
import { renderEmailDraft } from "@/shared/email-template";
import {
  isLegacySeededProfile,
  isProfileOnboarded,
  normalizeResearchFields,
} from "@/shared/profile-utils";
import type { ProfileDraft } from "@/shared/types";
import { useGmailStatus } from "@/src/hooks/use-gmail-status";
import { getSupportedTimezones } from "@/src/lib/timezones";
import styles from "./home-shell.module.css";

const defaultCompose = {
  professorName: "",
  professorEmail: "",
  researchTitle: "",
  researchAbstract: "",
  researchField: "",
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
  const { gmailStatus, gmailStatusLoading } = useGmailStatus();
  const queryArgs = isAuthenticated ? {} : "skip";

  const profile = useQuery(api.profiles.getForCurrentUser, queryArgs) as
    | (ProfileDraft & { userId?: string })
    | undefined;
  const attachments = (useQuery(api.attachments.list, queryArgs) ?? []) as Array<any>;
  const scheduled = (useQuery(api.emails.listScheduled, queryArgs) ?? []) as Array<any>;
  const recent = (useQuery(api.emails.listRecent, queryArgs) ?? []) as Array<any>;

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
  const [message, setMessage] = useState<{
    type: "info" | "success" | "error";
    text: string;
  } | null>(null);
  const [isGenerating, startGenerating] = useTransition();
  const [isScheduling, startScheduling] = useTransition();
  const [isSending, startSending] = useTransition();

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
      degree: shouldTreatAsBlank ? "" : profile.degree ?? defaultProfile.degree,
      school: shouldTreatAsBlank ? "" : profile.school ?? defaultProfile.school,
      location: shouldTreatAsBlank ? "" : profile.location ?? defaultProfile.location,
      phone: shouldTreatAsBlank ? "" : profile.phone ?? defaultProfile.phone,
      defaultSubject:
        shouldTreatAsBlank ? "" : profile.defaultSubject ?? defaultProfile.defaultSubject,
      introduction:
        shouldTreatAsBlank ? "" : profile.introduction ?? defaultProfile.introduction,
      closingText:
        shouldTreatAsBlank ? "" : profile.closingText ?? defaultProfile.closingText,
      researchFields,
      honors: shouldTreatAsBlank ? [] : profile.honors ?? defaultProfile.honors,
      publicationBlurb: shouldTreatAsBlank
        ? ""
        : profile.publicationBlurb ?? defaultProfile.publicationBlurb,
      goodEmailExamples: shouldTreatAsBlank
        ? ""
        : profile.goodEmailExamples ?? defaultProfile.goodEmailExamples,
    });
    setCompose((current) => ({
      ...current,
      researchField: researchFields[0]?.name ?? current.researchField,
    }));
    setDraftSubject(
      shouldTreatAsBlank ? "" : profile.defaultSubject ?? defaultProfile.defaultSubject,
    );
    setProfileHydrated(true);
  }, [profile, profileHydrated, user?.firstName, user?.lastName]);

  useEffect(() => {
    if (profile && profileHydrated && !isProfileOnboarded(profile)) {
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

  async function handleGenerateDraft() {
    if (!compose.researchField) {
      setMessage({
        type: "error",
        text: "Add at least one research field on the profile page before generating a draft.",
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
    if (!gmailStatus.connected) {
      setMessage({
        type: "error",
        text:
          "Google mail permission is not ready. Sign out, sign back in with Google, and approve Gmail send access once.",
      });
      return;
    }

    if (!draftText.trim() || !draftSubject.trim()) {
      setMessage({
        type: "error",
        text: "Generate or write a subject and draft before sending.",
      });
      return;
    }

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
    if (!gmailStatus.connected) {
      setMessage({
        type: "error",
        text:
          "Google mail permission is not ready. Sign out, sign back in with Google, and approve Gmail send access once.",
      });
      return;
    }

    if (!draftText.trim() || !draftSubject.trim()) {
      setMessage({
        type: "error",
        text: "Generate or write a subject and draft before scheduling.",
      });
      return;
    }

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
            <span className={styles.eyebrow}>Mailing Workspace</span>
            <h1 className={styles.title}>Cold Mailer 469</h1>
            <p className={styles.lead}>
              Generate drafts against your own saved research fields, keep the body
              editable, and send consistently formatted HTML through Gmail with
              history preserved per user.
            </p>
            <div className={styles.heroActions}>
              <Link href="/profile" className={styles.button}>
                Open profile and docs
              </Link>
              <Link href="/onboarding" className={styles.buttonGhost}>
                Revisit onboarding
              </Link>
            </div>
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
              <span>Mail</span>
              <strong>
                {gmailStatusLoading
                  ? "Checking..."
                  : gmailStatus.connected
                    ? "Ready"
                    : "Needs consent"}
              </strong>
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
                    Generate a tailored research-intro paragraph, then edit the full
                    draft before sending.
                  </p>
                </div>
                <span
                  className={`${styles.statusPill} ${
                    gmailStatus.connected ? styles.statusConnected : styles.statusFailed
                  }`}
                >
                  {gmailStatus.connected ? "Mail ready" : "Mail permission needed"}
                </span>
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
                    {researchFieldOptions.length === 0 ? (
                      <option value="">Add research fields on the profile page first</option>
                    ) : null}
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
                <Link href="/profile" className={styles.buttonGhost}>
                  Manage profile, fields, and docs
                </Link>
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
          </div>

          <div className={styles.column}>
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h3>Workspace status</h3>
                  <p>The sender profile, Google permission, and attachments used in this mail.</p>
                </div>
              </div>
              <div className={styles.list}>
                <div className={styles.listItem}>
                  <strong>Sender</strong>
                  <span className={styles.muted}>
                    {profileDraft.fullName || "Complete your profile name on the profile page."}
                  </span>
                </div>
                <div className={styles.listItem}>
                  <strong>Google mail</strong>
                  <span className={styles.muted}>
                    {gmailStatus.connected
                      ? gmailStatus.email ?? "Connected"
                      : gmailStatus.failureReason ??
                        "Sign out and sign back in with Google once to refresh the Gmail-send scope."}
                  </span>
                </div>
                <div className={styles.listItem}>
                  <strong>Research fields</strong>
                  <span className={styles.muted}>
                    {researchFieldOptions.length} configured for this user
                  </span>
                </div>
                <div className={styles.listItem}>
                  <strong>Attachments</strong>
                  <span className={styles.muted}>
                    {attachments.length} file{attachments.length === 1 ? "" : "s"} attached
                  </span>
                </div>
              </div>
            </section>

            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h3>Rendered preview</h3>
                  <p>This is the HTML body that will be sent from Gmail.</p>
                </div>
              </div>
              <div
                className={styles.listItem}
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
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
                    <span className={styles.muted}>No scheduled emails yet.</span>
                  </div>
                ) : (
                  [...scheduled]
                    .sort(
                      (left, right) =>
                        (left.scheduledForUtcMs ?? 0) - (right.scheduledForUtcMs ?? 0),
                    )
                    .map((email) => (
                      <div key={email._id} className={styles.listItem}>
                        <strong>{email.professorName}</strong>
                        <span className={styles.muted}>{email.professorEmail}</span>
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
                      <span className={styles.muted}>{email.professorEmail}</span>
                      <br />
                      <span className={styles.muted}>
                        {email.sentAtMs
                          ? formatDateTime(email.sentAtMs)
                          : formatDateTime(email.createdAt)}
                      </span>
                      {email.failureReason ? (
                        <>
                          <br />
                          <span className={styles.muted}>{email.failureReason}</span>
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
