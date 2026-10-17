import { NextResponse } from "next/server";
import { db } from "@/lib/db/drizzle";
import { captionStyles } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

// GET: Retrieve all available caption styles
export async function GET() {
  try {
    const rawStyles = await db.select().from(captionStyles);

    // Ensure styleProperties is returned as a parsed JSON object for the frontend
    const parsedStyles = rawStyles.map((style) => {
      let properties = style.styleProperties;
      if (typeof properties === "string") {
        try {
          properties = JSON.parse(properties);
        } catch (e) { }
      }
      return {
        ...style,
        styleProperties: properties,
      };
    });

    return NextResponse.json({ styles: parsedStyles });
  } catch (error: any) {
    console.error("Error fetching caption styles:", error);
    return NextResponse.json(
      { error: "Failed to fetch styles", details: error.message },
      { status: 500 }
    );
  }
}
