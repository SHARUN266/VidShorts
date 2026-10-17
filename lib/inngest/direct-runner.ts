import { db } from "@/lib/db/drizzle";
import { projects, shortVideoClips, captionStyles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { transcribeVideo } from "@/lib/transcription/deepgram";
import { findViralClips, ensureHinglishTransliteration } from "@/lib/ai/gemini";
import path from "path";
import fs from "fs";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderMedia } from "@remotion/renderer";

const execPromise = promisify(exec);

// Global cache for Remotion Webpack bundle to eliminate 30-45s bundling overhead on subsequent renders
let cachedRemotionBundle: string | null = null;
let bundlingPromise: Promise<string> | null = null;

async function getOrBuildRemotionBundle(): Promise<string> {
  if (cachedRemotionBundle && fs.existsSync(cachedRemotionBundle)) {
    return cachedRemotionBundle;
  }
  if (!bundlingPromise) {
    console.log("Direct Renderer: Bundling Remotion composition (cache enabled)...");
    bundlingPromise = bundle({
      entryPoint: path.resolve(process.cwd(), "remotion", "index.ts"),
      enableCache: true,
    })
      .then((loc) => {
        cachedRemotionBundle = loc;
        return loc;
      })
      .finally(() => {
        bundlingPromise = null;
      });
  }
  return bundlingPromise;
}

/**
 * Direct background runner for video transcription and AI clip finding.
 * Executes natively inside Node.js without requiring external CLI tools.
 */
export async function runDirectVideoProcessing(projectId: string) {
  console.log(`Direct Worker: Starting AI pipeline for project ${projectId}...`);

  // 1. Mark status as transcribing
  await db
    .update(projects)
    .set({ status: "transcribing" })
    .where(eq(projects.id, projectId));

  try {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));
    if (!project) return;

    const filePath = path.join(
      process.cwd(),
      "public",
      project.originalVideoUrl.replace(/^\//, "")
    );

    // 2. Transcribe with Deepgram
    console.log(`Direct Worker: Transcribing ${filePath}...`);
    const { transcriptText, words } = await transcribeVideo(filePath);

    // 3. Save transcript & set status to analyzing immediately
    await db
      .update(projects)
      .set({
        status: "analyzing",
        transcription: transcriptText,
        captionsJson: words,
      })
      .where(eq(projects.id, projectId));

    // 4. Extract highlight clips with Gemini 2.5 Flash directly
    console.log(`Direct Worker: Extracting viral clips with Gemini 2.5 Flash...`);
    const clips = await findViralClips(transcriptText, words);

    // 5. Transliterate captions for ONLY the extracted clips in parallel (sub-second per clip!)
    console.log(`Direct Worker: Formatting captions into Hinglish for ${clips.length} selected clips...`);
    await Promise.all(
      clips.map(async (clip) => {
        const clipId = crypto.randomUUID();
        const rawClipCaptions = words.filter(
          (w) => w.start >= clip.startTimeSeconds && w.end <= clip.endTimeSeconds
        );
        const clipCaptions = await ensureHinglishTransliteration(rawClipCaptions);

        await db.insert(shortVideoClips).values({
          id: clipId,
          projectId: projectId,
          title: clip.title,
          description: clip.description,
          startTimeSeconds: clip.startTimeSeconds,
          endTimeSeconds: clip.endTimeSeconds,
          seoScore: clip.seoScore,
          reason: clip.reason,
          clipCaptionsJson: clipCaptions,
          status: "pending",
        });
      })
    );

    // 6. Mark project status as ready!
    await db
      .update(projects)
      .set({ status: "ready" })
      .where(eq(projects.id, projectId));
    console.log(`Direct Worker: Project ${projectId} successfully completed!`);
  } catch (err: any) {
    console.error(`Direct Worker Error for project ${projectId}:`, err);
    await db
      .update(projects)
      .set({
        status: "failed",
        errorMessage: err.message || String(err),
      })
      .where(eq(projects.id, projectId));
  }
}

/**
 * Direct background runner for Remotion vertical MP4 rendering.
 * Compiles Remotion compositions natively inside Node.js.
 */
export async function runDirectClipRender(
  projectId: string,
  clipId: string,
  captionStyleId?: string,
  customStyleProperties?: any
) {
  try {
    console.log(`Direct Renderer: Starting render for clip ${clipId}...`);

    const [clip] = await db
      .select()
      .from(shortVideoClips)
      .where(eq(shortVideoClips.id, clipId));
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));
    if (!clip || !project) return;

    let styleObj: any = null;

    // 1. If customStyleProperties passed from UI, use it as top priority!
    if (customStyleProperties && typeof customStyleProperties === "object") {
      styleObj = customStyleProperties;
    } else if (captionStyleId) {
      const [s] = await db
        .select()
        .from(captionStyles)
        .where(eq(captionStyles.id, captionStyleId));
      if (s) styleObj = s.styleProperties;
    }

    if (!styleObj && clip.captionStyleId) {
      const [s] = await db
        .select()
        .from(captionStyles)
        .where(eq(captionStyles.id, clip.captionStyleId));
      if (s) styleObj = s.styleProperties;
    }

    if (!styleObj) {
      const [defaultStyle] = await db
        .select()
        .from(captionStyles)
        .where(eq(captionStyles.isDefault, true));
      if (defaultStyle) styleObj = defaultStyle.styleProperties;
      else {
        styleObj = {
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
        };
      }
    }

    if (typeof styleObj === "string") {
      try {
        styleObj = JSON.parse(styleObj);
      } catch (e) {}
    }

    const renderedDir = path.join(process.cwd(), "public", "uploads", "rendered");
    if (!fs.existsSync(renderedDir)) {
      fs.mkdirSync(renderedDir, { recursive: true });
    }
    const outputLocation = path.join(renderedDir, `${clipId}.mp4`);
    const rawVideoHttpUrl = project.originalVideoUrl.startsWith("http")
      ? project.originalVideoUrl
      : `http://localhost:3000${project.originalVideoUrl.startsWith("/") ? "" : "/"}${project.originalVideoUrl}`;

    // Pre-slice clip segment with FFmpeg to eliminate Chrome seek latency
    const rawVideoDiskPath = path.join(
      process.cwd(),
      "public",
      project.originalVideoUrl.replace(/^\//, "")
    );
    const tempClipDir = path.join(process.cwd(), "public", "uploads", "temp_clips");
    if (!fs.existsSync(tempClipDir)) {
      fs.mkdirSync(tempClipDir, { recursive: true });
    }
    const tempClipPath = path.join(tempClipDir, `slice-${clipId}.mp4`);
    const tempClipHttpUrl = `http://localhost:3000/uploads/temp_clips/slice-${clipId}.mp4`;
    const durationInSeconds = Math.max(1, clip.endTimeSeconds - clip.startTimeSeconds);

    console.log(`Direct Renderer: Slicing clip (${durationInSeconds}s) with FFmpeg for instant seek-free rendering...`);
    try {
      await execPromise(
        `ffmpeg -y -ss ${clip.startTimeSeconds} -i "${rawVideoDiskPath}" -t ${durationInSeconds} -c:v libx264 -preset ultrafast -crf 19 -c:a aac "${tempClipPath}"`
      );
    } catch (sliceErr) {
      console.warn("FFmpeg pre-slicing failed, falling back to full video stream:", sliceErr);
    }

    const useSlicedClip = fs.existsSync(tempClipPath);
    const renderVideoUrl = useSlicedClip ? tempClipHttpUrl : rawVideoHttpUrl;
    const renderStartSeconds = useSlicedClip ? 0 : clip.startTimeSeconds;

    const rawSubtitles = clip.clipCaptionsJson || [];
    const normalizedSubtitles = useSlicedClip
      ? rawSubtitles.map((w: any) => ({
          ...w,
          start: Math.max(0, w.start - clip.startTimeSeconds),
          end: Math.max(0, w.end - clip.startTimeSeconds),
        }))
      : rawSubtitles;

    const bundleLocation = await getOrBuildRemotionBundle();

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: "ShortsVideo",
      inputProps: {
        videoUrl: renderVideoUrl,
        startTimeSeconds: renderStartSeconds,
        durationInSeconds: durationInSeconds,
        subtitles: normalizedSubtitles,
        styleProperties: styleObj,
      },
    });

    const cpuCount = os.cpus().length;
    const concurrency = Math.min(8, Math.max(4, Math.floor(cpuCount / 2)));

    console.log(`Direct Renderer: Compiling MP4 to ${outputLocation} (Concurrency: ${concurrency} threads)...`);
    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: "h264",
      outputLocation,
      imageFormat: "jpeg",
      jpegQuality: 85,
      crf: 23,
      concurrency,
      disallowParallelEncoding: false,
      inputProps: {
        videoUrl: renderVideoUrl,
        startTimeSeconds: renderStartSeconds,
        durationInSeconds: durationInSeconds,
        subtitles: normalizedSubtitles,
        styleProperties: styleObj,
      },
    });

    // Cleanup temporary slice
    if (useSlicedClip && fs.existsSync(tempClipPath)) {
      try {
        fs.unlinkSync(tempClipPath);
      } catch {}
    }

    const relativeRenderedUrl = `/uploads/rendered/${clipId}.mp4`;
    await db
      .update(shortVideoClips)
      .set({
        status: "rendered",
        renderedVideoUrl: relativeRenderedUrl,
        editedSinceLastRender: false,
      })
      .where(eq(shortVideoClips.id, clipId));

    console.log(`Direct Renderer: Render completed! File saved to ${relativeRenderedUrl}`);
  } catch (err: any) {
    console.error(`Direct Renderer Error for clip ${clipId}:`, err);
    await db
      .update(shortVideoClips)
      .set({ status: "failed" })
      .where(eq(shortVideoClips.id, clipId));
    throw err;
  }
}
