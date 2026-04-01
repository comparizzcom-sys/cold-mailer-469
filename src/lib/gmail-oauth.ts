const gmailScope = "https://www.googleapis.com/auth/gmail.send";

export function buildGoogleAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri:
      process.env.GOOGLE_REDIRECT_URI ??
      "http://localhost:3000/api/gmail/callback",
    response_type: "code",
    scope: gmailScope,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3000/api/gmail/callback";

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth environment variables are missing.");
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    scope: gmailScope,
  };
}
