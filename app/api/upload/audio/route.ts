import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { writeFile } from "fs/promises";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadsDir = path.join(process.cwd(), "public", "uploads", "audio");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const sanitizedFilename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const filePath = path.join(uploadsDir, sanitizedFilename);

    await writeFile(filePath, buffer);

    const publicUrl = `/uploads/audio/${sanitizedFilename}`;
    console.log(`Audio Upload API: Saved ${sanitizedFilename} to ${filePath}`);

    return NextResponse.json({
      success: true,
      audioUrl: publicUrl,
      filename: file.name,
    });
  } catch (error: any) {
    console.error("Error uploading audio file:", error);
    return NextResponse.json(
      { error: "Failed to upload audio file", details: error.message },
      { status: 500 }
    );
  }
}
