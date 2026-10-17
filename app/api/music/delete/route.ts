import { NextResponse } from "next/server";
import { db } from "@/lib/db/drizzle";
import { audioTracks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { trackId, audioUrl } = await req.json();

    if (!trackId && !audioUrl) {
      return NextResponse.json(
        { error: "Provide trackId or audioUrl to delete" },
        { status: 400 }
      );
    }

    if (trackId) {
      await db.delete(audioTracks).where(eq(audioTracks.id, trackId));
    }

    if (audioUrl && audioUrl.startsWith("/uploads/audio/")) {
      const filePath = path.join(process.cwd(), "public", audioUrl.replace(/^\//, ""));
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.warn("Could not delete physical audio file:", e);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Audio track deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting audio track:", error);
    return NextResponse.json(
      { error: "Failed to delete audio track", details: error.message },
      { status: 500 }
    );
  }
}
