"use client";

import { useState } from "react";

const contactEmail = "aymaanalam.nitt@gmail.com";

export function BetaAccessPill() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(contactEmail);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="authNotice">
      <span className="authNoticeText">
        Cold Mailer 469 is still in beta. Contact me to request access.
      </span>
      <details className="authNoticeDetails">
        <summary>Contact me</summary>
        <div className="authNoticeMenu">
          <a
            className="authNoticeAction"
            href={`mailto:${contactEmail}?subject=Cold%20Mailer%20469%20access`}
          >
            Email me
          </a>
          <button
            type="button"
            className="authNoticeAction"
            onClick={handleCopy}
          >
            {copied ? "Copied" : "Copy email"}
          </button>
        </div>
      </details>
    </div>
  );
}
