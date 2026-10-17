"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Video, 
  FolderOpen, 
  ArrowLeft, 
  Download, 
  Youtube, 
  Loader2, 
  CheckCircle, 
  Sparkles,
  ExternalLink
} from "lucide-react";

interface Clip {
  id: string;
  projectId: string;
  title: string;
  description: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  seoScore: number;
  reason: string;
  status: string;
  renderedVideoUrl: string | null;
  youtubeVideoId: string | null;
  createdAt: string;
}

export default function VideosLibrary() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [publishingStates, setPublishingStates] = useState<Record<string, boolean>>({});

  const fetchClips = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/clips/all");
      const data = await res.json();
      if (res.ok) {
        setClips(data.clips || []);
      }
    } catch (err) {
      console.error("Failed to load clips library", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClips();
  }, []);

  const handlePublishToYouTube = async (clipId: string) => {
    setPublishingStates((prev) => ({ ...prev, [clipId]: true }));
    try {
      const res = await fetch("/api/youtube/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clipId, privacyStatus: "public" }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.details || "Failed to publish to YouTube");
      }

      alert(`✅ Success! Published to YouTube Shorts!\nURL: ${data.youtubeUrl}`);
      // Refresh list
      fetchClips();
    } catch (err: any) {
      alert(`Publish error: ${err.message}`);
    } finally {
      setPublishingStates((prev) => ({ ...prev, [clipId]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-900 bg-zinc-950 p-6 flex flex-col justify-between hidden md:flex">
        <div className="space-y-8">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 bg-yellow-500 rounded-xl flex items-center justify-center font-bold text-zinc-950 text-lg shadow-lg shadow-yellow-500/10">
              VS
            </div>
            <span className="font-bold text-xl tracking-tight text-zinc-100">
              VidShot<span className="text-yellow-500">.</span>
            </span>
          </div>

          <nav className="space-y-1">
            <Link
              href="/dashboard"
              className="flex items-center space-x-3 px-4 py-3 hover:bg-zinc-900/40 rounded-xl text-zinc-400 hover:text-zinc-200 text-sm font-medium transition"
            >
              <Video className="h-4 w-4" />
              <span>Dashboard</span>
            </Link>
            <Link
              href="/videos"
              className="flex items-center space-x-3 px-4 py-3 bg-zinc-900/60 border border-zinc-800 rounded-xl text-zinc-200 text-sm font-medium transition"
            >
              <FolderOpen className="h-4 w-4 text-yellow-500" />
              <span>My Videos</span>
            </Link>
          </nav>
        </div>

        <div className="border-t border-zinc-900 pt-6">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center font-semibold text-xs text-zinc-300">
              P
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-300">Personal Account</p>
              <p className="text-[10px] text-zinc-500">Local Environment</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-8 overflow-y-auto max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">My Shorts Library</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Browse rendered vertical clips and publish directly to YouTube Shorts.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="py-20 text-center flex flex-col items-center justify-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
            <p className="text-sm text-zinc-400">Loading library clips...</p>
          </div>
        ) : clips.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/20">
            <p className="text-sm text-zinc-400">No clips found in library.</p>
            <p className="text-xs text-zinc-600 mt-1">
              Go to Dashboard, ingest a video, and render clips to see them here.
            </p>
            <Link
              href="/dashboard"
              className="mt-4 inline-flex items-center space-x-2 text-xs font-semibold bg-yellow-500 hover:bg-yellow-600 text-zinc-950 px-4 py-2 rounded-xl transition"
            >
              <span>Go to Dashboard</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clips.map((clip) => (
              <div
                key={clip.id}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-zinc-700 transition"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <h3 className="text-sm font-semibold text-zinc-100 line-clamp-2 leading-tight">
                      {clip.title}
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                      Score: {clip.seoScore}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 line-clamp-2">{clip.description}</p>
                </div>

                {/* Status & Video Preview Tag */}
                <div className="pt-3 border-t border-zinc-800/60 space-y-3">
                  <div className="flex items-center justify-between text-xs text-zinc-500">
                    <span>Duration: {(clip.endTimeSeconds - clip.startTimeSeconds).toFixed(1)}s</span>
                    <span className="capitalize font-semibold text-zinc-300">{clip.status}</span>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center space-x-2 pt-1">
                    {clip.renderedVideoUrl ? (
                      <a
                        href={clip.renderedVideoUrl}
                        download
                        className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold py-2 px-3 rounded-xl flex items-center justify-center space-x-1.5 transition"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>MP4</span>
                      </a>
                    ) : null}

                    {clip.youtubeVideoId ? (
                      <a
                        href={`https://www.youtube.com/shorts/${clip.youtubeVideoId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600/30 text-xs font-semibold py-2 px-3 rounded-xl flex items-center justify-center space-x-1.5 transition"
                      >
                        <Youtube className="h-3.5 w-3.5 text-red-500" />
                        <span>Live Short</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : clip.status === "rendered" ? (
                      <button
                        onClick={() => handlePublishToYouTube(clip.id)}
                        disabled={publishingStates[clip.id]}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold py-2 px-3 rounded-xl flex items-center justify-center space-x-1.5 transition disabled:opacity-50"
                      >
                        {publishingStates[clip.id] ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Youtube className="h-3.5 w-3.5" />
                        )}
                        <span>Publish Short</span>
                      </button>
                    ) : (
                      <Link
                        href={`/projects/${clip.projectId}`}
                        className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-zinc-950 text-xs font-semibold py-2 px-3 rounded-xl flex items-center justify-center space-x-1 transition"
                      >
                        <span>Render in Editor</span>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
