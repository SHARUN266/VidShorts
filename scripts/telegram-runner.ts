import path from "path";
import fs from "fs";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import youtubedlDefault, { create as createYoutubeDl } from "youtube-dl-exec";
import { transcribeVideo } from "../lib/transcription/deepgram";
import { findViralClips, ensureHinglishTransliteration } from "../lib/ai/gemini";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderMedia } from "@remotion/renderer";
import { uploadToYouTubeShorts } from "../lib/youtube/uploader";

const execPromise = promisify(exec);

// Load .env.local
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [k, ...v] = trimmed.split("=");
      if (k && v.length > 0) {
        process.env[k.trim()] = v.join("=").trim();
      }
    }
  }
}

const botToken = process.env.TELEGRAM_BOT_TOKEN;
if (!botToken) {
  console.error("❌ TELEGRAM_BOT_TOKEN is missing in .env.local");
  process.exit(1);
}

// Cross-platform yt-dlp binary resolution (Windows, Linux, GitHub Actions)
let youtubedl = youtubedlDefault;
const winBinary = path.join(process.cwd(), "node_modules", "youtube-dl-exec", "bin", "yt-dlp.exe");
const linuxBinary = path.join(process.cwd(), "node_modules", "youtube-dl-exec", "bin", "yt-dlp");

if (process.platform === "win32" && fs.existsSync(winBinary)) {
  youtubedl = createYoutubeDl(winBinary);
} else if (fs.existsSync(linuxBinary)) {
  try {
    fs.chmodSync(linuxBinary, "755");
  } catch {}
  youtubedl = createYoutubeDl(linuxBinary);
} else if (fs.existsSync("/usr/local/bin/yt-dlp")) {
  youtubedl = createYoutubeDl("/usr/local/bin/yt-dlp");
}

async function sendTelegramMessage(chatId: number | string, text: string) {
  if (!chatId || String(chatId).trim() === "") return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
    });
  } catch (err) {
    console.error("Failed to send Telegram message:", err);
  }
}

async function sendTelegramVideo(chatId: number | string, videoPath: string, caption: string) {
  if (!chatId || String(chatId).trim() === "") return;
  try {
    const fileBuffer = fs.readFileSync(videoPath);
    const formData = new FormData();
    formData.append("chat_id", String(chatId));
    formData.append("caption", caption);
    formData.append("video", new Blob([fileBuffer]), path.basename(videoPath));

    await fetch(`https://api.telegram.org/bot${botToken}/sendVideo`, {
      method: "POST",
      body: formData,
    });
  } catch (err) {
    console.error("Failed to send Telegram video:", err);
  }
}

let cachedBundleLocation: string | null = null;
async function getRemotionBundle(): Promise<string> {
  if (cachedBundleLocation && fs.existsSync(cachedBundleLocation)) {
    return cachedBundleLocation;
  }
  cachedBundleLocation = await bundle({
    entryPoint: path.resolve(process.cwd(), "remotion", "index.ts"),
    enableCache: true,
  });
  return cachedBundleLocation;
}

import http from "http";

let staticServerStarted = false;
function ensureStaticServer(port = 3000): Promise<void> {
  if (staticServerStarted) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const server = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url || "/", `http://localhost:${port}`);
      const filePath = path.join(process.cwd(), "public", parsedUrl.pathname.replace(/^\//, ""));
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const stream = fs.createReadStream(filePath);
        res.writeHead(200, {
          "Content-Type": "video/mp4",
          "Access-Control-Allow-Origin": "*",
        });
        stream.pipe(res);
      } else {
        res.writeHead(404);
        res.end("Not Found");
      }
    });

    server.listen(port, () => {
      staticServerStarted = true;
      resolve();
    });

    server.on("error", () => {
      staticServerStarted = true;
      resolve();
    });
  });
}

export async function processVideoFromTelegram(youtubeUrl: string, chatId: number | string) {
  await ensureStaticServer(3000);
  const videoId = crypto.randomUUID();
  const rawDir = path.join(process.cwd(), "public", "uploads", "raw");
  const renderedDir = path.join(process.cwd(), "public", "uploads", "rendered");
  const tempClipDir = path.join(process.cwd(), "public", "uploads", "temp_clips");

  [rawDir, renderedDir, tempClipDir].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  const rawFilePath = path.join(rawDir, `${videoId}.mp4`);
  const renderedFilePath = path.join(renderedDir, `${videoId}.mp4`);
  const tempClipPath = path.join(tempClipDir, `slice-${videoId}.mp4`);

  try {
    // 1. Acknowledge
    await sendTelegramMessage(
      chatId,
      `🎬 *YouTube URL Mil Gaya!*\n\n⏳ *Step 1/4: Downloading Video...*\n_Link:_ ${youtubeUrl}`
    );

    // 2. Fast Download with yt-dlp
    await youtubedl(youtubeUrl, {
      output: rawFilePath,
      noPlaylist: true,
      jsRuntimes: "node",
      concurrentFragments: 4,
      format: "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]/bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
    });

    // Check temp fallback
    const tempDownload = rawFilePath.replace(/\.mp4$/i, ".temp.mp4");
    if (!fs.existsSync(rawFilePath) && fs.existsSync(tempDownload)) {
      await new Promise((r) => setTimeout(r, 1000));
      fs.renameSync(tempDownload, rawFilePath);
    }

    // 3. Transcribe with Deepgram
    await sendTelegramMessage(
      chatId,
      `🎙️ *Step 2/4: Transcribing Audio with Deepgram Nova-2...*\n_Speech-to-text ho raha hai..._`
    );
    const { transcriptText, words } = await transcribeVideo(rawFilePath);

    // 4. Gemini 2.5 Flash Highlight Finding
    await sendTelegramMessage(
      chatId,
      `🧠 *Step 3/4: Gemini AI Viral Clips Analysis...*\n_Top viral hook dhundh kar Hinglish captions generate kar raha hu..._`
    );
    let clips = await findViralClips(transcriptText, words);
    if (!clips || clips.length === 0) {
      clips = [
        {
          title: "🔥 Viral Moment! #Shorts",
          description: "Must watch viral moment! Like, share and subscribe for daily viral shorts.",
          tags: ["Shorts", "Viral", "Trending", "FYP"],
          startTimeSeconds: 0,
          endTimeSeconds: 30,
          seoScore: 90,
          reason: "Fallback highlight segment.",
        },
      ];
    }

    // Pick top clip
    const topClip = clips[0];
    const duration = Math.max(1, topClip.endTimeSeconds - topClip.startTimeSeconds);

    // Transliterate only top clip's words
    const rawClipWords = words.filter(
      (w) => w.start >= topClip.startTimeSeconds && w.end <= topClip.endTimeSeconds
    );
    const clipCaptions = await ensureHinglishTransliteration(rawClipWords);

    // 5. Pre-slice clip with FFmpeg for instant seek-free render
    await sendTelegramMessage(
      chatId,
      `⚡ *Step 4/4: Multi-core Remotion Video Rendering...*\n_Title:_ *${topClip.title}*\n_Duration:_ ${Math.round(duration)}s | _SEO Score:_ ${topClip.seoScore}/100`
    );

    await execPromise(
      `ffmpeg -y -ss ${topClip.startTimeSeconds} -i "${rawFilePath}" -t ${duration} -c:v libx264 -preset ultrafast -crf 19 -c:a aac "${tempClipPath}"`
    );

    const normalizedSubtitles = clipCaptions.map((w) => ({
      ...w,
      start: Math.max(0, w.start - topClip.startTimeSeconds),
      end: Math.max(0, w.end - topClip.startTimeSeconds),
    }));

    const bundleLocation = await getRemotionBundle();
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: "ShortsVideo",
      chromiumOptions: {
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      },
      inputProps: {
        videoUrl: `http://localhost:3000/uploads/temp_clips/slice-${videoId}.mp4`,
        startTimeSeconds: 0,
        durationInSeconds: duration,
        subtitles: normalizedSubtitles,
        styleProperties: {
          fontFamily: "'Lilita One', 'Montserrat', Anton, Impact, sans-serif",
          fontSizePx: 64,
          textColor: "#FFFFFF",
          highlightColor: "#FFE600",
          backgroundColor: "#FFE600",
          textStroke: "7px #000000",
          badgeStyle: "box",
          activeAnimation: "hormozi-pop",
          textPosition: "center",
          maxDisplayWords: 3,
          videoFilter: "none",
        },
      },
    });

    const cpuCount = os.cpus().length;
    const concurrency = Math.min(8, Math.max(4, Math.floor(cpuCount / 2)));

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: "h264",
      outputLocation: renderedFilePath,
      imageFormat: "jpeg",
      jpegQuality: 85,
      crf: 23,
      concurrency,
      disallowParallelEncoding: false,
      chromiumOptions: {
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      },
      inputProps: {
        videoUrl: `http://localhost:3000/uploads/temp_clips/slice-${videoId}.mp4`,
        startTimeSeconds: 0,
        durationInSeconds: duration,
        subtitles: normalizedSubtitles,
        styleProperties: {
          fontFamily: "'Lilita One', 'Montserrat', Anton, Impact, sans-serif",
          fontSizePx: 64,
          textColor: "#FFFFFF",
          highlightColor: "#FFE600",
          backgroundColor: "#FFE600",
          textStroke: "7px #000000",
          badgeStyle: "box",
          activeAnimation: "hormozi-pop",
          textPosition: "center",
          maxDisplayWords: 3,
          videoFilter: "none",
        },
      },
    });

    // Cleanup temp slice
    if (fs.existsSync(tempClipPath)) {
      try { fs.unlinkSync(tempClipPath); } catch {}
    }

    // 6. Direct Publish to YouTube Shorts
    await sendTelegramMessage(chatId, `🚀 *Uploading to YouTube Shorts directly...*`);
    let youtubeResult: any = null;
    try {
      youtubeResult = await uploadToYouTubeShorts({
        filePath: renderedFilePath,
        title: topClip.title,
        description: topClip.description,
        tags: topClip.tags,
        privacyStatus: "public",
      });
    } catch (uploadErr: any) {
      console.warn("YouTube Shorts direct upload failed:", uploadErr);
    }

    // 7. Send final confirmation & Video File to Telegram
    const ytLink = youtubeResult?.youtubeUrl || "Pending Manual Upload";
    const successCaption = `🎉 *Shorts Video Ready!*\n\n📌 *Title:* ${topClip.title}\n\n📺 *YouTube Shorts Link:* ${ytLink}\n\n🔥 *Viral Tags:* #${topClip.tags.slice(0, 5).join(" #")}`;

    await sendTelegramMessage(chatId, successCaption);

    // Send the actual MP4 file to Telegram chat
    if (fs.existsSync(renderedFilePath)) {
      await sendTelegramVideo(chatId, renderedFilePath, `🎥 Ready Short: ${topClip.title}`);
    }
  } catch (error: any) {
    console.error("Telegram Pipeline Error:", error);
    await sendTelegramMessage(
      chatId,
      `❌ *Error aa gaya:*\n\`${error.message || String(error)}\``
    );
    throw error;
  } finally {
    // Cleanup raw download to save space
    if (fs.existsSync(rawFilePath)) {
      try { fs.unlinkSync(rawFilePath); } catch {}
    }
  }
}

// Telegram Long Polling Loop
let lastUpdateId = 0;
async function pollTelegramUpdates() {
  console.log(`🤖 VidShorts Telegram Bot is listening for YouTube links...`);
  console.log(`📱 Open Telegram and send any YouTube URL to: @vidshort266bot`);

  while (true) {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`
      );
      const data = (await res.json()) as any;

      if (data.ok && data.result && data.result.length > 0) {
        for (const update of data.result) {
          lastUpdateId = update.update_id;
          const message = update.message;
          if (!message || !message.text) continue;

          const text = message.text.trim();
          const chatId = message.chat.id;

          if (text === "/start") {
            await sendTelegramMessage(
              chatId,
              `👋 *Namaste! Main aapka AI Video Automation Bot hu.*\n\nBas mujhe koi bhi **YouTube Video Link** bhej do, main usme se:\n\n1. 🎯 Top viral moment dhundhunga\n2. 📝 Animated Hinglish Captions lagauga\n3. 📱 9:16 Vertical Video render karunga\n4. 🚀 Direct YouTube Shorts par post karunga\n5. 📥 Aur video file bhi yahi bhej dunga!\n\n_Bhejo koi bhi YouTube link shuru karne ke liye!_`
            );
            continue;
          }

          const ytRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{11}[\S]*)/i;
          const match = text.match(ytRegex);

          if (match && match[1]) {
            const youtubeUrl = match[1];
            processVideoFromTelegram(youtubeUrl, chatId).catch(console.error);
          } else {
            await sendTelegramMessage(
              chatId,
              `⚠️ Kripya ek valid **YouTube Video URL** bhejein (e.g., https://www.youtube.com/watch?v=...)`
            );
          }
        }
      }
    } catch (err) {
      console.error("Polling error, retrying in 3s...", err);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

// Start polling if executed directly
if (require.main === module || process.argv[1]?.includes("telegram-runner")) {
  pollTelegramUpdates();
}
