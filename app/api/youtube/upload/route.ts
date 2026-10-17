import { NextResponse } from "next/server";
import { db } from "@/lib/db/drizzle";
import { shortVideoClips } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { uploadToYouTubeShorts } from "@/lib/youtube/uploader";
import { runDirectClipRender } from "@/lib/inngest/direct-runner";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { clipId, privacyStatus = "public", customStyleProperties } = await req.json();

    if (!clipId) {
      return NextResponse.json({ error: "Missing clipId parameter" }, { status: 400 });
    }

    // 1. Fetch clip from DB
    const [clip] = await db
      .select()
      .from(shortVideoClips)
      .where(eq(shortVideoClips.id, clipId));

    if (!clip) {
      return NextResponse.json({ error: "Clip not found" }, { status: 404 });
    }

    const renderedDir = path.join(process.cwd(), "public", "uploads", "rendered");
    const expectedFilePath = path.join(renderedDir, `${clipId}.mp4`);

    // 2. If clip is not rendered or file does not exist on disk, render it now!
    if (clip.status !== "rendered" || !fs.existsSync(expectedFilePath)) {
      console.log(`YouTube Upload API: Clip ${clipId} is not rendered yet. Triggering direct render first...`);
      
      await db
        .update(shortVideoClips)
        .set({ status: "rendering" })
        .where(eq(shortVideoClips.id, clipId));

      await runDirectClipRender(clip.projectId, clipId, clip.captionStyleId || undefined, customStyleProperties);

      if (!fs.existsSync(expectedFilePath)) {
        return NextResponse.json(
          { error: "Rendering failed or output video not found on disk." },
          { status: 500 }
        );
      }
    }

    // 3. Execute upload using YouTube Data API v3
    console.log(`YouTube Upload API: Uploading ${expectedFilePath} to YouTube Shorts...`);
    const uploadResult = await uploadToYouTubeShorts({
      filePath: expectedFilePath,
      title: clip.title,
      description: clip.description,
      tags: ["Shorts", "ViralClip"],
      privacyStatus,
    });

    // 4. Save video ID in DB
    await db
      .update(shortVideoClips)
      .set({
        youtubeVideoId: uploadResult.videoId,
        renderedVideoUrl: `/uploads/rendered/${clipId}.mp4`,
        status: "rendered",
      })
      .where(eq(shortVideoClips.id, clipId));

    return NextResponse.json({
      success: true,
      videoId: uploadResult.videoId,
      youtubeUrl: uploadResult.youtubeUrl,
    });
  } catch (error: any) {
    console.error("Error publishing to YouTube Shorts:", error);
    return NextResponse.json(
      { error: "Failed to publish to YouTube Shorts", details: error.message || error.toString() },
      { status: 500 }
    );
  }
}
