import { NextResponse } from "next/server";
import { db } from "@/lib/db/drizzle";
import { shortVideoClips } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { inngest } from "@/lib/inngest/client";
import { runDirectClipRender } from "@/lib/inngest/direct-runner";

// Force Node.js runtime (Remotion requires full Node.js to launch browser/render)
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { projectId, clipId, captionStyleId, customStyleProperties } = await req.json();

    if (!projectId || !clipId) {
      return NextResponse.json(
        { error: "Provide both projectId and clipId" },
        { status: 400 }
      );
    }

    // 1. Fetch clip to verify existence
    const [clip] = await db
      .select()
      .from(shortVideoClips)
      .where(eq(shortVideoClips.id, clipId));

    if (!clip) {
      return NextResponse.json({ error: "Clip not found" }, { status: 404 });
    }

    // 2. Update status to rendering and save chosen caption style ID
    await db
      .update(shortVideoClips)
      .set({
        status: "rendering",
        captionStyleId: captionStyleId || clip.captionStyleId,
      })
      .where(eq(shortVideoClips.id, clipId));

    // 3. Trigger Inngest background rendering job (if available)
    try {
      await inngest.send({
        name: "clip.render",
        data: {
          projectId,
          clipId,
          captionStyleId: captionStyleId || clip.captionStyleId,
        },
      });
      console.log(`Triggered Inngest rendering background job for clip: ${clipId}`);
    } catch (inngestErr) {
      console.warn("Inngest server offline, running direct rendering task...");
    }

    // Trigger direct native background renderer
    runDirectClipRender(projectId, clipId, captionStyleId || clip.captionStyleId, customStyleProperties).catch((err) =>
      console.error("Direct renderer processing error:", err)
    );

    return NextResponse.json({
      success: true,
      message: "Rendering started in background",
      status: "rendering",
    });
  } catch (error: any) {
    console.error("Error initiating render:", error);
    return NextResponse.json(
      { error: "Failed to start render", details: error.message },
      { status: 500 }
    );
  }
}
