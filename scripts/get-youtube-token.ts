import { google } from "googleapis";
import fs from "fs";
import path from "path";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, "utf-8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...vals] = trimmed.split("=");
      if (key && vals.length > 0) {
        process.env[key.trim()] = vals.join("=").trim();
      }
    }
  }
}

const clientId = process.env.YOUTUBE_CLIENT_ID;
const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error("❌ YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET must be set in .env.local");
  process.exit(1);
}

const redirectUri = process.env.YOUTUBE_REDIRECT_URI || "http://localhost:3000/api/youtube/callback";
const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube",
  ],
});

console.log("\n=======================================================");
console.log("🔑 YouTube OAuth Refresh Token Generator");
console.log("=======================================================\n");
console.log("1. Ensure your dev server is running (`npm run dev`).");
console.log("2. Open your browser and visit:\n");
console.log(`   \x1b[36mhttp://localhost:3000/api/youtube/auth\x1b[0m\n`);
console.log("   OR click this direct Google login link:\n");
console.log(`   \x1b[34m${authUrl}\x1b[0m\n`);
console.log("3. Authorize your Google Account.");
console.log("4. The token will be automatically updated in .env.local!\n");
console.log("=======================================================\n");
