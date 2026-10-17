import { GoogleGenAI, Type } from "@google/genai";

export interface ViralClip {
  title: string;
  description: string;
  tags: string[];
  startTimeSeconds: number;
  endTimeSeconds: number;
  seoScore: number;
  reason: string;
}

/**
 * Converts any Devanagari Hindi words into Roman Hindi (Hinglish in English alphabet)
 * using Gemini 2.5 Flash while maintaining exact start/end timestamps.
 */
export async function ensureHinglishTransliteration<T extends { word: string }>(
  words: T[]
): Promise<T[]> {
  const hasDevanagari = words.some((w) => /[\u0900-\u097F]/.test(w.word));
  if (!hasDevanagari) {
    return words; // Already in English or Roman Hindi!
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    return words;
  }

  console.log("Gemini: Devanagari script detected. Transliterating captions into Roman Hindi (Hinglish)...");
  const ai = new GoogleGenAI({ apiKey });

  const rawWordsList = words.map((w) => w.word);
  const prompt = `
Convert the following array of Devanagari Hindi words into Roman Hindi (Hinglish written using the standard English alphabet, e.g., "Namaste dosto, kaise hain aap").
Return a JSON array of strings corresponding 1-to-1 with the input array. Maintain exact element count and order.

Input Words:
${JSON.stringify(rawWordsList)}
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
    });

    const transliterated: string[] = JSON.parse(response.text || "[]");
    if (transliterated.length === words.length) {
      console.log("Gemini: Transliteration to Roman Hindi complete!");
      return words.map((w, idx) => ({
        ...w,
        word: transliterated[idx] || w.word,
      }));
    }
  } catch (err) {
    console.warn("Hinglish transliteration fallback warning:", err);
  }

  return words;
}

/**
 * Uses Gemini 2.5 Flash to analyze a transcript with timestamps 
 * and extract the top 4-5 viral highlight clips in Roman Hindi (Hinglish).
 */
export async function findViralClips(
  transcriptText: string,
  words: Array<{ word: string; start: number; end: number }>
): Promise<ViralClip[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    throw new Error("GEMINI_API_KEY is not configured in environment variables.");
  }

  // If no spoken words detected in audio (music/sound-only video), generate default highlight clip
  if (!words || words.length === 0) {
    console.log("Gemini: No spoken words found in audio. Generating default highlight clip...");
    return [
      {
        title: "🔥 Must Watch Viral Moment! #Shorts",
        description:
          "Check out this viral moment! Like, share, and subscribe for daily trending shorts!\n\n❓ Question Addressed: What makes this moment so captivating?\n💡 Direct Answer: Watch till the end to see the action.\n\nKey Highlights:\n• Trending viral video\n• Must watch till end\n• Share with friends and family",
        tags: [
          "Shorts",
          "YouTubeShorts",
          "Viral",
          "Trending",
          "FYP",
          "ViralVideo",
          "Explore",
          "WatchTillEnd",
          "DailyShorts",
        ],
        startTimeSeconds: 0,
        endTimeSeconds: 35,
        seoScore: 92,
        reason: "Visual highlight segment selected for maximum retention.",
      },
    ];
  }

  // 1. Group words into rough sentences/phrases
  const timelineSegments: string[] = [];
  const chunkSize = 15;
  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize);
    const startTime = chunk[0].start;
    const endTime = chunk[chunk.length - 1].end;
    const text = chunk.map((w) => w.word).join(" ");
    timelineSegments.push(`[${startTime.toFixed(2)}s - ${endTime.toFixed(2)}s]: "${text}"`);
  }

  const timelineContent = timelineSegments.join("\n");

  const prompt = `
You are a viral video editor and YouTube algorithm specialist. 
Your task is to analyze the following video transcript timeline and select 1 to 5 of the most viral, engaging, and cohesive highlight clips for YouTube Shorts (9:16 vertical format).

Follow these CRITICAL language, SEO, GEO & AEO rules:
1. ALWAYS write clip titles, descriptions, and hashtags in Roman Hindi (Hinglish written in English alphabet, e.g. "Aapka Swagat Hai", "Ye Clip Dekho"). Do NOT use Devanagari script.
2. Each clip should ideally be between 15 seconds and 60 seconds long (or adjust to the available video length).
3. Each clip must represent a complete, cohesive thought or story arc (e.g., starts with a hook or question, and ends with a punchline or completion of a tip).
4. Do NOT cut mid-sentence. Align your start and end times precisely to the boundaries of the timeline segments provided.
5. Calculate an SEO Score (0-100) based on how strong the hook is, curiosity gap, and viral engagement potential.
6. GENERATE A VERY RICH DESCRIPTION (150-250 words) OPTIMIZED FOR SEO, GEO (Generative Engine Optimization) & AEO (Answer Engine Optimization):
   - SEO: Topic summary, search keywords, and Call-To-Action ("Like, Share & Subscribe for more!").
   - AEO (Answer Engine Optimization): Include a direct Q&A format like:
     "❓ Question Addressed: [Insert core question]"
     "💡 Direct Answer: [Insert 1-2 sentence crisp direct answer]"
   - GEO (Generative Engine Optimization): Include 3 bullet points of key takeaways & entity summaries so AI Search Engines (ChatGPT, Perplexity, Gemini, Google SGE) parse & cite this video in AI search answers!
7. GENERATE A LARGE ARRAY OF 15 TO 20 HIGH-RANKING HASHTAGS (without '#' prefix), including SEO, AEO, and GEO tags like: Shorts, YouTubeShorts, Viral, Trending, FYP, ShortsFeed, ViralVideo, Explore, WatchTillEnd, HindiShorts, DailyShorts, ViralShorts, QnA, Explained, HowTo, LearnOnShorts, Knowledge.
8. ALWAYS return at least 1 compelling highlight clip. Do NOT return an empty list.

Video Timeline Transcript:
${timelineContent}

Output your response as a JSON array matching the requested schema.
`;

  console.log("Gemini: Initializing client...");
  const ai = new GoogleGenAI({ apiKey });

  console.log("Gemini: Generating content using gemini-2.5-flash...");
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              tags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              startTimeSeconds: { type: Type.NUMBER },
              endTimeSeconds: { type: Type.NUMBER },
              seoScore: { type: Type.INTEGER },
              reason: { type: Type.STRING },
            },
            required: [
              "title",
              "description",
              "tags",
              "startTimeSeconds",
              "endTimeSeconds",
              "seoScore",
              "reason",
            ],
          },
        },
      },
    });

    const text = response.text;
    if (text) {
      const clips: ViralClip[] = JSON.parse(text);
      if (clips.length > 0) {
        console.log(`Gemini: Successfully extracted ${clips.length} viral clips.`);
        return clips;
      }
    }
  } catch (err) {
    console.warn("Gemini extraction warning, falling back to smart heuristic:", err);
  }

  // Automatic fallback clip based on available transcript words
  const firstWordStart = words[0]?.start || 0;
  const lastWordEnd = words[words.length - 1]?.end || firstWordStart + 35;
  const fallbackEnd = Math.min(firstWordStart + 45, Math.max(firstWordStart + 20, lastWordEnd));

  return [
    {
      title: "🔥 Viral Moment Dekho! #Shorts",
      description: `${transcriptText.slice(0, 180)}...\n\nLike, Share and Subscribe for more daily viral Shorts!\n\n❓ Question Addressed: Is video mein kya sikhne ko mila?\n💡 Direct Answer: Watch till the end for the best tip.\n\nKey Takeaways:\n• Viral tip explained\n• Watch till end\n• Share with friends`,
      tags: ["Shorts", "YouTubeShorts", "Viral", "Trending", "FYP", "HindiShorts", "DailyShorts"],
      startTimeSeconds: Math.floor(firstWordStart),
      endTimeSeconds: Math.ceil(fallbackEnd),
      seoScore: 89,
      reason: "Selected speech highlight segment from video.",
    },
  ];
}
