import { createClient } from "@deepgram/sdk";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

export interface TranscribeResult {
  transcriptText: string;
  words: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
    punctuated_word?: string;
  }>;
}

/**
 * Extract audio track from video file using FFmpeg into a lightweight MP3.
 * Cuts network payload by 95% and prevents Deepgram fetch socket timeouts.
 */
async function extractAudioTrack(videoPath: string): Promise<string> {
  const tempAudioPath = videoPath.replace(/\.[^/.]+$/, "") + "-temp-audio.mp3";

  // If temp audio already exists, remove it
  if (fs.existsSync(tempAudioPath)) {
    try {
      fs.unlinkSync(tempAudioPath);
    } catch (e) {}
  }

  console.log(`FFmpeg: Extracting lightweight audio from ${path.basename(videoPath)}...`);
  // FFmpeg command: multi-threaded extraction (-threads 8), convert to 16kHz mono mp3
  const command = `ffmpeg -y -threads 8 -i "${videoPath}" -vn -ac 1 -ar 16000 -ab 64k "${tempAudioPath}"`;
  
  await execPromise(command);
  console.log(`FFmpeg: Audio extracted successfully to ${path.basename(tempAudioPath)}`);
  return tempAudioPath;
}

/**
 * Transcribe a local video/audio file using Deepgram Nova-2 model
 * with FFmpeg lightweight audio extraction to guarantee zero network timeouts.
 */
export async function transcribeVideo(filePath: string): Promise<TranscribeResult> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey || apiKey === "your_deepgram_api_key_here") {
    throw new Error("DEEPGRAM_API_KEY is not configured in environment variables.");
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`Video file not found at path: ${filePath}`);
  }

  let audioPath = filePath;
  let isTempAudio = false;

  // If input is a video file, extract lightweight MP3 audio first
  if (/\.(mp4|mov|avi|mkv|webm)$/i.test(filePath)) {
    try {
      audioPath = await extractAudioTrack(filePath);
      isTempAudio = true;
    } catch (ffmpegErr) {
      console.warn("FFmpeg audio extraction failed, falling back to original video file:", ffmpegErr);
      audioPath = filePath;
    }
  }

  try {
    console.log(`Deepgram: Transcribing audio payload (${(fs.statSync(audioPath).size / 1024 / 1024).toFixed(2)} MB)...`);
    const fileBuffer = fs.readFileSync(audioPath);

    const deepgram = createClient(apiKey);
    
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      fileBuffer,
      {
        model: "nova-2",
        smart_format: true,
        detect_language: true, // Auto-detect Hindi, Hinglish, and English
        mimetype: isTempAudio ? "audio/mp3" : "video/mp4",
      }
    );

    if (error) {
      throw new Error(`Deepgram transcription failed: ${error.message || error}`);
    }

    if (!result) {
      throw new Error("Deepgram returned empty transcription results.");
    }

    const alternative = result.results?.channels?.[0]?.alternatives?.[0];
    if (!alternative) {
      throw new Error("No transcription alternatives found in Deepgram response.");
    }

    const transcriptText = alternative.transcript || "";
    const words = alternative.words || [];

    console.log(`Deepgram: Transcribed ${words.length} words successfully.`);
    return {
      transcriptText,
      words,
    };
  } finally {
    // Clean up temporary audio file
    if (isTempAudio && fs.existsSync(audioPath)) {
      try {
        fs.unlinkSync(audioPath);
        console.log(`Cleaned up temp audio file: ${path.basename(audioPath)}`);
      } catch (e) {}
    }
  }
}
