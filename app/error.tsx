"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <main className="authPage">
      <section className="errorCard">
        <h1>Something went wrong</h1>
        <p>
          The app hit a runtime error. Check the Amplify server logs for the
          tagged error details.
        </p>
        <p className="errorMeta">
          Message: {error.message || "Unknown error"}
          {error.digest ? ` | Digest: ${error.digest}` : ""}
        </p>
        <button className="topbarButton" type="button" onClick={() => reset()}>
          Try again
        </button>
      </section>
    </main>
  );
}
