import Link from "next/link";

import { AuthGate } from "@/components/auth/auth-gate";
import styles from "./help.module.css";

function HelpContent() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <span className={styles.eyebrow}>Help</span>
          <h1 className={styles.title}>How to use Cold Mailer</h1>
          <p className={styles.lead}>
            Set up your profile once, generate a tailored draft for each professor,
            edit the final wording, and send immediately or schedule it for later.
          </p>
          <div className={styles.actions}>
            <Link href="/" className={styles.button}>
              Mailing
            </Link>
            <Link href="/profile" className={styles.buttonGhost}>
              Profile
            </Link>
          </div>
        </section>

        <div className={styles.grid}>
          <section className={styles.section}>
            <h2>1. Set up your profile</h2>
            <ol className={styles.list}>
              <li>Add your name, degree, school, introduction, and closing text.</li>
              <li>Create the research fields you want to use while drafting.</li>
              <li>Upload your CV, transcript, and any extra supporting file.</li>
            </ol>
          </section>

          <section className={styles.section}>
            <h2>2. Check mail access</h2>
            <p>
              The app sends mail using your Google sign-in. If mail access is not
              ready, sign out and sign back in with Google once.
            </p>
          </section>

          <section className={styles.section}>
            <h2>3. Draft a mail</h2>
            <ol className={styles.list}>
              <li>Enter the professor name, email, paper title, and abstract.</li>
              <li>Select the research field that best matches your interest.</li>
              <li>
                Use the additional instruction box for prompt-level guidance, such as
                tone, emphasis, or specific things to mention.
              </li>
              <li>Click Draft, then edit the subject and body however you want.</li>
            </ol>
          </section>

          <section className={styles.section}>
            <h2>4. Send or schedule</h2>
            <ol className={styles.list}>
              <li>Use Send for immediate delivery.</li>
              <li>Use Schedule to queue the mail in your chosen timezone.</li>
              <li>Check Queued and History on the mailing page to track progress.</li>
            </ol>
          </section>
        </div>
      </div>
    </main>
  );
}

export default function HelpPage() {
  return (
    <AuthGate>
      <HelpContent />
    </AuthGate>
  );
}
