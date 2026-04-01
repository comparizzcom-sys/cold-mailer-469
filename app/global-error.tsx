"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-app-error]", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="authPage">
          <section className="errorCard">
            <h1>Application error</h1>
            <p>
              The app failed before rendering the page. Check Amplify logs for
              the tagged runtime details.
            </p>
            <p className="errorMeta">
              Message: {error.message || "Unknown error"}
              {error.digest ? ` | Digest: ${error.digest}` : ""}
            </p>
            <button className="topbarButton" type="button" onClick={() => reset()}>
              Retry
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
