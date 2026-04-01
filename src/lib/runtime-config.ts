type RuntimeCheck = {
  key: string;
  present: boolean;
};

type RuntimeConfigCheckOptions = {
  scope: string;
  requiredKeys?: string[];
};

const defaultRequiredKeys = [
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "NEXT_PUBLIC_CONVEX_URL",
];

export function getRuntimeChecks(requiredKeys = defaultRequiredKeys): RuntimeCheck[] {
  return requiredKeys.map((key) => ({
    key,
    present: Boolean(process.env[key]),
  }));
}

export function assertRuntimeConfig({
  scope,
  requiredKeys = defaultRequiredKeys,
}: RuntimeConfigCheckOptions) {
  const checks = getRuntimeChecks(requiredKeys);
  const missing = checks.filter((check) => !check.present).map((check) => check.key);

  if (missing.length > 0) {
    const message = `[runtime-config:${scope}] Missing required environment variables: ${missing.join(", ")}`;
    console.error(message, {
      scope,
      checks,
      nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
      clerkAuthorizedParties: process.env.CLERK_AUTHORIZED_PARTIES ?? null,
      clerkIssuer: process.env.CLERK_JWT_ISSUER_DOMAIN ?? null,
      nodeEnv: process.env.NODE_ENV ?? null,
    });
    throw new Error(message);
  }

  return checks;
}

export function logRuntimeContext(scope: string, extra?: Record<string, unknown>) {
  console.error(`[runtime-context:${scope}]`, {
    nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
    nextPublicConvexUrl: process.env.NEXT_PUBLIC_CONVEX_URL ?? null,
    clerkAuthorizedParties: process.env.CLERK_AUTHORIZED_PARTIES ?? null,
    clerkIssuer: process.env.CLERK_JWT_ISSUER_DOMAIN ?? null,
    nodeEnv: process.env.NODE_ENV ?? null,
    ...extra,
  });
}
