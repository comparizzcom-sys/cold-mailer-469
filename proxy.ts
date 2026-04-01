import { NextResponse, type NextRequest } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";

const authorizedParties = (
  process.env.CLERK_AUTHORIZED_PARTIES ?? ""
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const baseMiddleware = clerkMiddleware(
  authorizedParties.length > 0
    ? {
        authorizedParties,
      }
    : undefined,
);

function renderMiddlewareErrorPage(params: {
  title: string;
  message: string;
  request: NextRequest;
}) {
  const details = [
    ["Request host", params.request.nextUrl.host],
    ["Request URL", params.request.nextUrl.toString()],
    ["NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL ?? "(missing)"],
    [
      "CLERK_AUTHORIZED_PARTIES",
      process.env.CLERK_AUTHORIZED_PARTIES ?? "(missing)",
    ],
    [
      "CLERK_JWT_ISSUER_DOMAIN",
      process.env.CLERK_JWT_ISSUER_DOMAIN ?? "(missing in Next.js runtime)",
    ],
    [
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? "(present)" : "(missing)",
    ],
    ["CLERK_SECRET_KEY", process.env.CLERK_SECRET_KEY ? "(present)" : "(missing)"],
  ];

  const detailRows = details
    .map(
      ([label, value]) =>
        `<tr><th>${label}</th><td><code>${String(value)}</code></td></tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Cold Mailer 469 Diagnostic</title>
    <style>
      :root {
        color-scheme: dark;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        font-family: system-ui, sans-serif;
        background: #07101d;
        color: #edf4ff;
      }
      .card {
        width: min(900px, 100%);
        border: 1px solid rgba(172, 196, 229, 0.18);
        border-radius: 24px;
        background: rgba(10, 19, 34, 0.95);
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
        padding: 28px;
      }
      h1 {
        margin: 0 0 12px;
        font-size: 1.8rem;
      }
      p {
        color: #b7c7e2;
        line-height: 1.6;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 18px;
      }
      th, td {
        text-align: left;
        vertical-align: top;
        padding: 12px 10px;
        border-top: 1px solid rgba(172, 196, 229, 0.12);
      }
      th {
        width: 260px;
        color: #ffc27a;
        font-weight: 600;
      }
      code {
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
        word-break: break-word;
      }
      .hint {
        margin-top: 18px;
        padding: 14px 16px;
        border-radius: 16px;
        background: rgba(255, 122, 24, 0.12);
        color: #ffe0b8;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>${params.title}</h1>
      <p>${params.message}</p>
      <table>
        <tbody>${detailRows}</tbody>
      </table>
      <div class="hint">
        This page is rendered by middleware before React loads. If these values
        look wrong, the request is failing before the app UI can mount.
      </div>
    </main>
  </body>
</html>`;

  return new NextResponse(html, {
    status: 500,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export default async function middleware(request: NextRequest, event: any) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) {
    console.error("[middleware-config-error] Missing Clerk environment variables", {
      host: request.nextUrl.host,
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
      authorizedParties: process.env.CLERK_AUTHORIZED_PARTIES ?? null,
    });
    return renderMiddlewareErrorPage({
      title: "Clerk environment variables are missing",
      message:
        "The request failed in middleware before the app could render. Check the values shown below against your Amplify environment configuration.",
      request,
    });
  }

  try {
    return await baseMiddleware(request, event);
  } catch (error) {
    console.error("[middleware-runtime-error]", error);
    return renderMiddlewareErrorPage({
      title: "Middleware authentication failed",
      message:
        error instanceof Error
          ? error.message
          : "An unknown middleware error occurred before the app UI loaded.",
      request,
    });
  }
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
