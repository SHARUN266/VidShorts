import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { create as createYoutubeDl } from "youtube-dl-exec";
import { db } from "@/lib/db/drizzle";
import { audioTracks } from "@/lib/db/schema";

// Resolve explicit absolute path to yt-dlp binary
const binaryPath = path.join(
  process.cwd(),
  "node_modules",
  "youtube-dl-exec",
  "bin",
  "yt-dlp.exe"
);
const youtubedl = createYoutubeDl(binaryPath);

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { youtubeUrl } = await req.json();

    if (!youtubeUrl || typeof youtubeUrl !== "string") {
      return NextResponse.json(
        { error: "Provide a valid YouTube URL" },
        { status: 400 }
      );
    }

    const audioDir = path.join(process.cwd(), "public", "uploads", "audio");
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }

    const musicId = crypto.randomUUID();
    const audioFilename = `music-${musicId.slice(0, 8)}.mp3`;
    const outputPath = path.join(audioDir, audioFilename);

    console.log(`YouTube Music Import: Extracting audio from ${youtubeUrl}...`);

    let title = "YouTube Background Track";

    // 1. Fetch video metadata for title
    try {
      const info = (await youtubedl(youtubeUrl, {
        dumpSingleJson: true,
        noWarnings: true,
        noPlaylist: true,
        jsRuntimes: "node",
      })) as any;
      if (info && info.title) {
        title = info.title;
      }
    } catch (err) {
      console.warn("Could not fetch YouTube track metadata title, using default:", err);
    }

    // 2. Extract audio track to MP3 with Windows file lock safety
    try {
      await youtubedl(youtubeUrl, {
        output: outputPath,
        extractAudio: true,
        audioFormat: "mp3",
        noPlaylist: true,
        jsRuntimes: "node",
      });
    } catch (dlErr: any) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      if (!fs.existsSync(outputPath)) {
        throw dlErr;
      }
    }

    console.log(`YouTube Music Import: Successfully saved audio to ${outputPath}`);

    const relativeAudioUrl = `/uploads/audio/${audioFilename}`;

    // 3. Save entry in database audio_tracks table
    try {
      await db.insert(audioTracks).values({
        id: musicId,
        title,
        audioUrl: relativeAudioUrl,
        youtubeSourceUrl: youtubeUrl,
      });
    } catch (dbErr) {
      console.warn("Failed to insert audio_tracks record, continuing...", dbErr);
    }

    return NextResponse.json({
      success: true,
      track: {
        id: musicId,
        title,
        audioUrl: relativeAudioUrl,
        youtubeSourceUrl: youtubeUrl,
      },
      audioUrl: relativeAudioUrl,
      title,
    });
  } catch (error: any) {
    console.error("YouTube Music Import Error:", error);
    return NextResponse.json(
      {
        error: "Failed to extract audio from YouTube URL",
        details: error.message || error.toString(),
      },
      { status: 500 }
    );
  }
}
