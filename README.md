# Cold Mailer 469

Next.js + Convex rebuild of the legacy Python cold mailer.

## Stack

- Next.js App Router + TypeScript
- Convex for database, file storage, and scheduled jobs
- Clerk for product auth
- Gmail API for sending
- OpenAI for personalized research hooks

## Required environment variables

Copy `.env.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_JWT_ISSUER_DOMAIN`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `OPENAI_API_KEY`
- `GMAIL_TOKEN_ENCRYPTION_KEY`

## Local setup

1. Install dependencies with `npm install`.
2. Create a Convex project and run `npx convex dev`.
3. In Clerk, configure a JWT template named `convex`.
4. In Google Cloud, enable the Gmail API and register `GOOGLE_REDIRECT_URI`.
5. Start the app with `npm run dev`.

## Notes

- Gmail refresh tokens are encrypted before storage in Convex.
- Per-user profile data and attachments replace the old hardcoded template data.
- Scheduled emails are dispatched with `ctx.scheduler.runAt(...)`.
