"use client";

import { useAction, useConvexAuth } from "convex/react";
import { useEffect, useState } from "react";

import { api } from "@/convex/_generated/api";

export type GmailStatus = {
  connected: boolean;
  email: string | null;
  displayName: string | null;
  scopes: string[];
  connectedAt: number | null;
  failureReason?: string;
};

const defaultStatus: GmailStatus = {
  connected: false,
  email: null,
  displayName: null,
  scopes: [],
  connectedAt: null,
};

export function useGmailStatus() {
  const { isAuthenticated } = useConvexAuth();
  const fetchStatus = useAction(api.gmailActions.getStatus);
  const [status, setStatus] = useState<GmailStatus>(defaultStatus);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!isAuthenticated) {
        setStatus(defaultStatus);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const result = await fetchStatus({});
        if (!cancelled) {
          setStatus(result as GmailStatus);
        }
      } catch (error) {
        if (!cancelled) {
          setStatus({
            ...defaultStatus,
            failureReason:
              error instanceof Error ? error.message : "Failed to read Gmail status.",
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [fetchStatus, isAuthenticated]);

  return {
    gmailStatus: status,
    gmailStatusLoading: isLoading,
  };
}
