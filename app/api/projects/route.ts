import { NextResponse } from "next/server";
import { db } from "@/lib/db/drizzle";
import { projects, shortVideoClips } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import path from "path";
import fs from "fs";
import { writeFile } from "fs/promises";
import { create as createYoutubeDl } from "youtube-dl-exec";
import { inngest } from "@/lib/inngest/client";
import { runDirectVideoProcessing } from "@/lib/inngest/direct-runner";

// Resolve explicit absolute path to yt-dlp binary to avoid Next.js virtual path resolution bugs
const binaryPath = path.join(
  process.cwd(),
  "node_modules",
  "youtube-dl-exec",
  "bin",
  "yt-dlp.exe"
);
const youtubedl = createYoutubeDl(binaryPath);

// Force Node.js runtime and dynamic execution
export const dynamic = "force-dynamic";

// GET: Retrieve all projects
export async function GET() {
  try {
    const allProjects = await db
      .select()
      .from(projects)
      .orderBy(desc(projects.createdAt));
    return NextResponse.json({ projects: allProjects });
  } catch (error: any) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects", details: error.message },
      { status: 500 }
    );
  }
}

async function safeDownloadYouTubeVideo(url: string, targetFilePath: string) {
  const baseName = targetFilePath.replace(/\.mp4$/i, "");
  const tempPath = `${baseName}.temp.mp4`;

  try {
    await youtubedl(url, {
      output: targetFilePath,
      noPlaylist: true,
      jsRuntimes: "node",
      concurrentFragments: 4,
      format: "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]/bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
    });
  } catch (err: any) {
    console.warn("yt-dlp exited with error, checking if merged video exists...", err.message || err);

    // Give Windows Defender / file watchers a moment to release file handles
    await new Promise((resolve) => setTimeout(resolve, 1500));

    if (fs.existsSync(tempPath)) {
      console.log(`Recovering merged video from ${tempPath} -> ${targetFilePath}`);
      try {
        if (fs.existsSync(targetFilePath)) {
          fs.unlinkSync(targetFilePath);
        }
        fs.renameSync(tempPath, targetFilePath);
      } catch (renameErr) {
        fs.copyFileSync(tempPath, targetFilePath);
        try {
          fs.unlinkSync(tempPath);
        } catch {}
      }
    } else if (!fs.existsSync(targetFilePath)) {
      throw err;
    }
  }

  // Clean up any lingering fragment streams (.f140, .f616, .temp.mp4)
  try {
    const dir = path.dirname(targetFilePath);
    const idPrefix = path.basename(baseName);
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file.startsWith(idPrefix) && file !== path.basename(targetFilePath)) {
        try {
          fs.unlinkSync(path.join(dir, file));
        } catch {}
      }
    }
  } catch {}
}

// POST: Create project (file upload or YouTube URL)
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    const projectId = crypto.randomUUID();
    const rawDir = path.join(process.cwd(), "public", "uploads", "raw");

    // Ensure raw upload directory exists
    if (!fs.existsSync(rawDir)) {
      fs.mkdirSync(rawDir, { recursive: true });
    }

    let title = "Untitled Project";
    let videoFilename = `${projectId}.mp4`;
    let originalVideoUrl = `/uploads/raw/${videoFilename}`;
    let youtubeSourceUrl: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      // 1. Local File Upload Mode
      const formData = await req.formData();
      const file = formData.get("file") as File;

      if (!file) {
        return NextResponse.json({ error: "No video file provided" }, { status: 400 });
      }

      title = file.name.replace(/\.[^/.]+$/, ""); // strip extension
      videoFilename = `${projectId}-${file.name.replace(/\s+/g, "_")}`;
      originalVideoUrl = `/uploads/raw/${videoFilename}`;

      const filePath = path.join(rawDir, videoFilename);
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(filePath, buffer);
      console.log(`Saved local uploaded file to: ${filePath}`);
    } else {
      // 2. YouTube URL Ingestion Mode
      const body = await req.json();
      const { youtubeUrl } = body;

      if (!youtubeUrl) {
        return NextResponse.json(
          { error: "Provide either a file upload or a YouTube URL" },
          { status: 400 }
        );
      }

      youtubeSourceUrl = youtubeUrl;
      const filePath = path.join(rawDir, videoFilename);

      console.log(`Downloading YouTube video: ${youtubeUrl}`);
      // Fetch metadata first to get video title
      try {
        const info = await youtubedl(youtubeUrl, {
          dumpSingleJson: true,
          noWarnings: true,
          noPlaylist: true,
          jsRuntimes: "node",
        }) as any;
        if (info && info.title) {
          title = info.title;
        }
      } catch (err) {
        console.warn("Could not fetch video title from YouTube, using fallback", err);
        title = "YouTube Video";
      }

      // Download best available format with Windows file lock recovery
      await safeDownloadYouTubeVideo(youtubeUrl, filePath);
      console.log(`Saved downloaded YouTube video to: ${filePath}`);
    }

    // Create database row in projects table
    const [project] = await db
      .insert(projects)
      .values({
        id: projectId,
        title,
        originalVideoUrl,
        youtubeSourceUrl,
        status: "uploaded",
      })
      .returning();

    // Trigger Inngest background processing pipeline (if available)
    try {
      await inngest.send({
        name: "video.uploaded",
        data: { projectId: project.id },
      });
      console.log(`Triggered Inngest workflow for project: ${project.id}`);
    } catch (inngestErr) {
      console.warn("Inngest server offline, running direct background pipeline...");
    }

    // Trigger direct native background pipeline (zero CLI dependency)
    runDirectVideoProcessing(project.id).catch((err) =>
      console.error("Direct worker processing error:", err)
    );

    return NextResponse.json({ project });
  } catch (error: any) {
    console.error("Error creating project:", error);
    return NextResponse.json(
      { error: "Failed to create project", details: error.message },
      { status: 500 }
    );
  }
}

// DELETE: Delete a project and its associated clips & raw files
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing project id" }, { status: 400 });
    }

    // 1. Delete clips for this project
    await db.delete(shortVideoClips).where(eq(shortVideoClips.projectId, id));

    // 2. Delete raw video file if exists
    const rawVideoPath = path.join(process.cwd(), "public", "uploads", "raw", `${id}.mp4`);
    if (fs.existsSync(rawVideoPath)) {
      try {
        fs.unlinkSync(rawVideoPath);
      } catch (e) {}
    }

    // 3. Delete project row
    await db.delete(projects).where(eq(projects.id, id));

    return NextResponse.json({ success: true, message: "Project deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { error: "Failed to delete project", details: error.message },
      { status: 500 }
    );
  }
}
