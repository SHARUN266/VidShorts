import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "trending";

    // Jamendo Open API v3.0 public client_id
    const jamendoClientId = "566329b4";
    const jamendoUrl = `https://api.jamendo.com/v3.0/tracks/?client_id=${jamendoClientId}&format=json&limit=25&search=${encodeURIComponent(
      query
    )}&audioformat=mp32&order=popularity_week`;

    console.log(`Music Search API: Fetching tracks for query "${query}"...`);
    const res = await fetch(jamendoUrl);
    
    if (!res.ok) {
      throw new Error(`Jamendo API returned status ${res.status}`);
    }

    const data = await res.json();
    const tracks = (data.results || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      artist: t.artist_name,
      audioUrl: t.audio,
      duration: t.duration,
      image: t.album_image || t.image,
      category: t.musicinfo?.tags?.genres?.[0] || "Trending",
    }));

    return NextResponse.json({ success: true, tracks });
  } catch (error: any) {
    console.error("Error searching Jamendo music API:", error);
    
    // Fallback static curated tracks if offline
    return NextResponse.json({
      success: true,
      tracks: [
        {
          id: "tech-house",
          name: "Tech House (Insta Reels Hype)",
          artist: "Mixkit Hype",
          audioUrl: "https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3",
          category: "House",
        },
        {
          id: "insta-trap",
          name: "Instagram Trap & Hip-Hop Beat",
          artist: "Mixkit Beats",
          audioUrl: "https://assets.mixkit.co/music/preview/mixkit-hip-hop-02-738.mp3",
          category: "Trap",
        },
        {
          id: "energetic-vibe",
          name: "Viral Energetic Beats",
          artist: "Mixkit Energy",
          audioUrl: "https://assets.mixkit.co/music/preview/mixkit-energetic-hip-hop-833.mp3",
          category: "Energetic",
        },
      ],
    });
  }
}
