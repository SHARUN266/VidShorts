import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const audioUrl = searchParams.get("url");

    if (!audioUrl) {
      return NextResponse.json({ error: "Missing audio url" }, { status: 400 });
    }

    // If it's already a local path, pass-through or redirect
    if (audioUrl.startsWith("/")) {
      const fullUrl = `http://localhost:3000${audioUrl}`;
      const res = await fetch(fullUrl);
      const audioBuffer = await res.arrayBuffer();
      return new Response(audioBuffer, {
        headers: {
          "Content-Type": "audio/mpeg",
          "Access-Control-Allow-Origin": "*",
          "Accept-Ranges": "bytes",
        },
      });
    }

    console.log(`Audio Proxy: Fetching external audio from ${audioUrl}...`);
    const audioRes = await fetch(audioUrl, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!audioRes.ok) {
      console.warn(`Audio proxy fetch returned ${audioRes.status}, redirecting directly...`);
      return NextResponse.redirect(audioUrl);
    }

    const audioData = await audioRes.arrayBuffer();

    return new Response(audioData, {
      headers: {
        "Content-Type": audioRes.headers.get("content-type") || "audio/mpeg",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error: any) {
    console.error("Audio Proxy error:", error);
    return NextResponse.json(
      { error: "Audio proxy failure", details: error.message },
      { status: 500 }
    );
  }
}
