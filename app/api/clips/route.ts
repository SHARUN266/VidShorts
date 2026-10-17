import { NextResponse } from "next/server";
import { db } from "@/lib/db/drizzle";
import { shortVideoClips } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET: Retrieve clips for a specific project
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId parameter" }, { status: 400 });
    }

    const clips = await db
      .select()
      .from(shortVideoClips)
      .where(eq(shortVideoClips.projectId, projectId))
      .orderBy(desc(shortVideoClips.seoScore));

    return NextResponse.json({ clips });
  } catch (error: any) {
    console.error("Error fetching clips:", error);
    return NextResponse.json(
      { error: "Failed to fetch clips", details: error.message },
      { status: 500 }
    );
  }
}
