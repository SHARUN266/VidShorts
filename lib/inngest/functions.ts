import { inngest } from "./client";
import { db } from "@/lib/db/drizzle";
import { projects, shortVideoClips, captionStyles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { transcribeVideo } from "@/lib/transcription/deepgram";
import { findViralClips, ensureHinglishTransliteration } from "@/lib/ai/gemini";
import path from "path";
import fs from "fs";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderMedia } from "@remotion/renderer";

export const processVideoWorkflow = inngest.createFunction(
  { id: "process-video-workflow", name: "Process Video Workflow" },
  { event: "video.uploaded" },
  async ({ event, step }) => {
    const { projectId } = event.data;

    // 1. Mark project as transcribing
    await step.run("update-status-transcribing", async () => {
      await db
        .update(projects)
        .set({ status: "transcribing" })
        .where(eq(projects.id, projectId));
    });

    try {
      // 2. Fetch project details
      const project = await step.run("fetch-project-details", async () => {
        const [p] = await db
          .select()
          .from(projects)
          .where(eq(projects.id, projectId));
        if (!p) throw new Error(`Project ${projectId} not found.`);
        return p;
      });

      // Resolve absolute file path for video
      const filePath = path.join(
        process.cwd(),
        "public",
        project.originalVideoUrl.replace(/^\//, "")
      );

      // 3. Transcribe audio using Deepgram
      const { transcriptText, words } = await step.run("transcribe-video", async () => {
        return await transcribeVideo(filePath);
      });

      // 3.5 Transliterate any Devanagari Hindi script into Roman Hindi (Hinglish)
      const { hinglishTranscript, hinglishWords } = await step.run("transliterate-hinglish", async () => {
        const hWords = await ensureHinglishTransliteration(words);
        const hText = hWords.map((w) => w.word).join(" ");
        return { hinglishTranscript: hText, hinglishWords: hWords };
      });

      // 4. Update project transcript & status to analyzing
      await step.run("update-transcript-in-db", async () => {
        await db
          .update(projects)
          .set({
            status: "analyzing",
            transcription: hinglishTranscript,
            captionsJson: hinglishWords,
          })
          .where(eq(projects.id, projectId));
      });

      // 5. Detect highlights using Gemini
      const clips = await step.run("detect-highlights", async () => {
        return await findViralClips(hinglishTranscript, hinglishWords);
      });

      // 6. Save highlights with pre-sliced captions in db
      await step.run("save-clips-to-db", async () => {
        for (const clip of clips) {
          const clipId = crypto.randomUUID();

          // Slices exact words list for this highlight time range
          const clipCaptions = words.filter(
            (w) => w.start >= clip.startTimeSeconds && w.end <= clip.endTimeSeconds
          );

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
            status: "pending", // 'pending' | 'rendering' | 'rendered' | 'failed'
          });
        }
      });

      // 7. Update status to ready
      await step.run("update-status-ready", async () => {
        await db
          .update(projects)
          .set({ status: "ready" })
          .where(eq(projects.id, projectId));
      });

      return { success: true, clipsCount: clips.length };
    } catch (error: any) {
      console.error(`Inngest: Process video failed for project ${projectId}:`, error);

      // Save error message and mark project as failed
      await step.run("update-status-failed", async () => {
        await db
          .update(projects)
          .set({
            status: "failed",
            errorMessage: error.message || String(error),
          })
          .where(eq(projects.id, projectId));
      });

      throw error; // Propagate error for Inngest retry handling
    }
  }
);

export const renderClipWorkflow = inngest.createFunction(
  { id: "render-clip-workflow", name: "Render Clip Workflow" },
  { event: "clip.render" },
  async ({ event, step }) => {
    const { projectId, clipId, captionStyleId } = event.data;

    try {
      // 1. Fetch clip and project details
      const { clip, project } = await step.run("fetch-rendering-details", async () => {
        const [c] = await db
          .select()
          .from(shortVideoClips)
          .where(eq(shortVideoClips.id, clipId));
        if (!c) throw new Error(`Clip ${clipId} not found.`);

        const [p] = await db
          .select()
          .from(projects)
          .where(eq(projects.id, projectId));
        if (!p) throw new Error(`Project ${projectId} not found.`);

        return { clip: c, project: p };
      });

      // 2. Fetch Caption Style properties
      const styleProperties = await step.run("fetch-style-properties", async () => {
        let styleObj: any = null;

        if (captionStyleId) {
          const [s] = await db
            .select()
            .from(captionStyles)
            .where(eq(captionStyles.id, captionStyleId));
          if (s) {
            styleObj = s.styleProperties;
          }
        }

        // Fallback: Default Style
        if (!styleObj) {
          const [defaultStyle] = await db
            .select()
            .from(captionStyles)
            .where(eq(captionStyles.isDefault, true));
          
          if (defaultStyle) {
            styleObj = defaultStyle.styleProperties;
          } else {
            // Hard fallback
            styleObj = {
              fontFamily: "Impact, Arial Black",
              fontSizePx: 64,
              textColor: "#FFFFFF",
              highlightColor: "#EAB308",
              backgroundColor: "transparent",
              textPosition: "center",
            };
          }
        }

        return styleObj;
      });

      // 3. Setup output folder structure
      const renderedDir = path.join(process.cwd(), "public", "uploads", "rendered");
      if (!fs.existsSync(renderedDir)) {
        fs.mkdirSync(renderedDir, { recursive: true });
      }
      const outputLocation = path.join(renderedDir, `${clipId}.mp4`);

      // Resolve raw video HTTP URL for Remotion Chromium player
      const rawVideoHttpUrl = project.originalVideoUrl.startsWith("http")
        ? project.originalVideoUrl
        : `http://localhost:3000${project.originalVideoUrl.startsWith("/") ? "" : "/"}${project.originalVideoUrl}`;

      console.log(`Remotion Renderer: Bundling composition for clip ${clipId}...`);
      
      // 4. Bundle Remotion entrypoint
      const bundleLocation = await step.run("bundle-remotion-entrypoint", async () => {
        return await bundle({
          entryPoint: path.resolve(process.cwd(), "remotion", "index.ts"),
          // Disable webpack caching conflicts on local build
          enableCache: false,
        });
      });

      console.log(`Remotion Renderer: Selecting composition and preparing render...`);

      // 5. Select composition and feed props
      const durationInSeconds = Math.max(1, clip.endTimeSeconds - clip.startTimeSeconds);
      const composition = await step.run("select-remotion-composition", async () => {
        return await selectComposition({
          serveUrl: bundleLocation,
          id: "ShortsVideo",
          inputProps: {
            videoUrl: rawVideoHttpUrl,
            startTimeSeconds: clip.startTimeSeconds,
            durationInSeconds: durationInSeconds,
            subtitles: clip.clipCaptionsJson || [],
            styleProperties: styleProperties,
          },
        });
      });

      console.log(`Remotion Renderer: Rendering media to ${outputLocation}...`);

      // 6. Execute local MP4 compile
      await step.run("execute-media-render", async () => {
        await renderMedia({
          composition,
          serveUrl: bundleLocation,
          codec: "h264",
          outputLocation,
          inputProps: {
            videoUrl: rawVideoHttpUrl,
            startTimeSeconds: clip.startTimeSeconds,
            durationInSeconds: durationInSeconds,
            subtitles: clip.clipCaptionsJson || [],
            styleProperties: styleProperties,
          },
          // Concurrency optimization for local machines
          concurrency: 2,
        });
      });

      console.log(`Remotion Renderer: Rendering complete! File saved at: ${outputLocation}`);

      // 7. Update database record to rendered
      const relativeRenderedUrl = `/uploads/rendered/${clipId}.mp4`;
      await step.run("update-clip-status-rendered", async () => {
        await db
          .update(shortVideoClips)
          .set({
            status: "rendered",
            renderedVideoUrl: relativeRenderedUrl,
            editedSinceLastRender: false,
          })
          .where(eq(shortVideoClips.id, clipId));
      });

      return { success: true, file: relativeRenderedUrl };
    } catch (error: any) {
      console.error(`Inngest: Rendering failed for clip ${clipId}:`, error);

      // Save failure status in DB
      await step.run("update-clip-status-failed", async () => {
        await db
          .update(shortVideoClips)
          .set({ status: "failed" })
          .where(eq(shortVideoClips.id, clipId));
      });

      throw error;
    }
  }
);
