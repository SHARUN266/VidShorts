import { google } from "googleapis";
import fs from "fs";

export interface YouTubeUploadParams {
  filePath: string;
  title: string;
  description: string;
  tags: string[];
  privacyStatus?: "public" | "private" | "unlisted";
}

/**
 * Uploads a rendered vertical MP4 video clip directly to YouTube Shorts 
 * using YouTube Data API v3.
 */
export async function uploadToYouTubeShorts({
  filePath,
  title,
  description,
  tags = [],
  privacyStatus = "public",
}: YouTubeUploadParams) {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "YouTube credentials missing. Please set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, and YOUTUBE_REFRESH_TOKEN in .env.local"
    );
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`Rendered video file not found at path: ${filePath}`);
  }

  console.log(`YouTube Uploader: Initializing OAuth2 client for upload...`);
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const youtube = google.youtube({
    version: "v3",
    auth: oauth2Client,
  });

  // Ensure title includes #Shorts for YouTube Shorts algorithm indexing
  const formattedTitle = title.toLowerCase().includes("#shorts")
    ? title
    : `${title.substring(0, 85)} #Shorts`;
    
  const defaultViralHashtags = [
    "Shorts",
    "YouTubeShorts",
    "ShortsFeed",
    "Viral",
    "Trending",
    "FYP",
    "Explore",
    "ViralShorts",
    "HindiShorts",
    "TrendingShorts",
    "WatchTillEnd",
    "DailyShorts",
    "Motivation",
    "ContentCreator",
    "Explained",
    "HowTo",
    "QnA",
    "AEO",
    "GEO",
    "Knowledge",
  ];

  const combinedTags = Array.from(new Set([...tags, ...defaultViralHashtags]));
  const hashtagsString = combinedTags.map((t) => `#${t.replace(/^#/, "")}`).join(" ");
  const formattedDescription = `${description}\n\n🤖 GEO & AEO OPTIMIZED METADATA 🤖\n🔥 VIRAL HASHTAGS: ${hashtagsString}\n\n👍 Like, Share & Subscribe for more daily viral Shorts!\n#Shorts #ShortsFeed #Viral #Trending #AEO #GEO`;

  console.log(`YouTube Uploader: Uploading "${formattedTitle}" (${privacyStatus})...`);

  try {
    const response = await youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title: formattedTitle,
          description: formattedDescription,
          tags: combinedTags,
          categoryId: "22", // Category: People & Blogs
        },
        status: {
          privacyStatus: privacyStatus,
          selfDeclaredMadeForKids: false,
        },
      },
      media: {
        body: fs.createReadStream(filePath),
      },
    });

    const videoId = response.data.id;
    console.log(`YouTube Uploader: Successfully uploaded! Video ID: ${videoId}`);
    return {
      videoId,
      youtubeUrl: `https://www.youtube.com/shorts/${videoId}`,
      data: response.data,
    };
  } catch (err: any) {
    if (err?.message?.includes("invalid_grant") || err?.response?.data?.error === "invalid_grant") {
      throw new Error(
        "YouTube OAuth session expired or revoked (invalid_grant). Please re-authenticate by visiting http://localhost:3000/api/youtube/auth in your browser to generate a fresh token."
      );
    }
    throw err;
  }
}
