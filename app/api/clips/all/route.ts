import { NextResponse } from "next/server";
import { db } from "@/lib/db/drizzle";
import { shortVideoClips } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET: Retrieve all clips across all projects
export async function GET() {
  try {
    const allClips = await db
      .select()
      .from(shortVideoClips)
      .orderBy(desc(shortVideoClips.createdAt));

    return NextResponse.json({ clips: allClips });
  } catch (error: any) {
    console.error("Error fetching all clips:", error);
    return NextResponse.json(
      { error: "Failed to fetch all clips", details: error.message },
      { status: 500 }
    );
  }
}
