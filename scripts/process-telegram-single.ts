import { processVideoFromTelegram } from "./telegram-runner";

const youtubeUrl = process.argv[2];
const chatId = process.argv[3] || "";

if (!youtubeUrl) {
  console.error("Usage: npx tsx scripts/process-telegram-single.ts <YOUTUBE_URL> [TELEGRAM_CHAT_ID]");
  process.exit(1);
}

console.log(`Starting Cloud Video Process for: ${youtubeUrl} (Chat ID: ${chatId})`);
processVideoFromTelegram(youtubeUrl, chatId)
  .then(() => {
    console.log("Cloud Video Processing finished successfully!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Cloud Video Processing failed:", err);
    process.exit(1);
  });
