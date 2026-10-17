import { NextResponse } from "next/server";
import { google } from "googleapis";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return new NextResponse(`<h1>OAuth Authorization Failed</h1><p>${error}</p>`, {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  if (!code) {
    return new NextResponse("<h1>Missing OAuth Code</h1>", {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new NextResponse("<h1>Missing YouTube Client Credentials</h1>", {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  }

  try {
    const redirectUri = process.env.YOUTUBE_REDIRECT_URI || `${url.origin}/api/youtube/callback`;
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return new NextResponse(
        `<h1>Warning: No Refresh Token Returned</h1>` +
        `<p>Google did not return a new refresh token because consent was already given previously without forced prompt.</p>` +
        `<p>Please re-visit <a href="/api/youtube/auth">/api/youtube/auth</a> to retry with full consent.</p>`,
        { status: 400, headers: { "Content-Type": "text/html" } }
      );
    }

    // Update .env.local file automatically
    const envPath = path.join(process.cwd(), ".env.local");
    let envContent = "";
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, "utf-8");
    }

    if (envContent.includes("YOUTUBE_REFRESH_TOKEN=")) {
      envContent = envContent.replace(
        /YOUTUBE_REFRESH_TOKEN=.*/g,
        `YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}`
      );
    } else {
      envContent += `\nYOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}\n`;
    }

    fs.writeFileSync(envPath, envContent, "utf-8");
    process.env.YOUTUBE_REFRESH_TOKEN = tokens.refresh_token;

    return new NextResponse(
      `<!DOCTYPE html>
      <html>
        <head>
          <title>YouTube OAuth Success</title>
          <meta charset="utf-8">
        </head>
        <body style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 2.5rem; max-width: 650px; margin: 0 auto; background: #09090b; color: #f4f4f5; line-height: 1.6;">
          <div style="background: #18181b; border: 1px solid #27272a; padding: 2rem; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
            <h2 style="color: #22c55e; margin-top: 0; display: flex; align-items: center; gap: 0.5rem;">
              🎉 YouTube Authorization Successful!
            </h2>
            <p style="color: #d4d4d8;">Your new <strong>YOUTUBE_REFRESH_TOKEN</strong> has been automatically generated and saved to <code>.env.local</code>.</p>
            
            <div style="background: #09090b; padding: 1rem; border-radius: 8px; font-family: monospace; word-break: break-all; margin: 1.5rem 0; border: 1px solid #3f3f46; color: #a1a1aa; font-size: 0.85rem;">
              YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}
            </div>

            <div style="background: rgba(234, 179, 8, 0.1); border-left: 4px solid #eab308; padding: 1rem; border-radius: 4px; margin-bottom: 1.5rem;">
              <strong style="color: #eab308;">📌 Important Note on Token Expiration:</strong>
              <p style="color: #ca8a04; margin: 0.5rem 0 0 0; font-size: 0.9rem;">
                If your app status in Google Cloud Console is set to <strong>"Testing"</strong>, refresh tokens expire automatically every <strong>7 days</strong>. To prevent tokens from expiring, change your OAuth Consent Screen status to <strong>"In Production"</strong> in GCP.
              </p>
            </div>

            <a href="/dashboard" style="display: inline-block; background: #2563eb; color: white; padding: 0.6rem 1.2rem; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.95rem;">
              ← Back to Dashboard
            </a>
          </div>
        </body>
      </html>`,
      { status: 200, headers: { "Content-Type": "text/html" } }
    );
  } catch (err: any) {
    console.error("Error exchanging OAuth code:", err);
    return new NextResponse(`<h1>OAuth Exchange Error</h1><pre>${err.stack || err.message}</pre>`, {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  }
}
