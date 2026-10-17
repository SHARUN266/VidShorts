import { NextResponse } from "next/server";
import { db } from "@/lib/db/drizzle";
import { audioTracks } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const audioDir = path.join(process.cwd(), "public", "uploads", "audio");
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }

    // 1. Fetch saved tracks from DB
    let tracks: any[] = [];
    try {
      tracks = await db
        .select()
        .from(audioTracks)
        .orderBy(desc(audioTracks.createdAt));
    } catch (e) {
      console.warn("audio_tracks table query note:", e);
    }

    const dbAudioUrls = new Set(tracks.map((t) => t.audioUrl));

    // 2. Auto-index any MP3 files in public/uploads/audio that are not yet in DB
    const files = fs.readdirSync(audioDir);
    for (const file of files) {
      if (file.endsWith(".mp3") || file.endsWith(".m4a") || file.endsWith(".wav")) {
        const relativeUrl = `/uploads/audio/${file}`;
        if (!dbAudioUrls.has(relativeUrl)) {
          const trackId = crypto.randomUUID();
          const title = file.replace(/\.[^/.]+$/, "").replace(/^music-/, "Audio Track ");
          try {
            await db.insert(audioTracks).values({
              id: trackId,
              title,
              audioUrl: relativeUrl,
            });
            tracks.push({
              id: trackId,
              title,
              audioUrl: relativeUrl,
              createdAt: new Date().toISOString(),
            });
          } catch (err) {}
        }
      }
    }

    return NextResponse.json({
      success: true,
      tracks,
    });
  } catch (error: any) {
    console.error("Error fetching audio tracks list:", error);
    return NextResponse.json(
      { error: "Failed to fetch audio tracks", details: error.message },
      { status: 500 }
    );
  }
}
