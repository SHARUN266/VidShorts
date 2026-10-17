"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import ClipPlayer from "@/components/project/clip-player";
import { 
  ArrowLeft, 
  Sparkles, 
  TrendingUp, 
  Download, 
  Loader2, 
  CheckCircle,
  Video,
  Youtube,
  ExternalLink
} from "lucide-react";

interface Project {
  id: string;
  title: string;
  originalVideoUrl: string;
  youtubeSourceUrl: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

interface CaptionStyle {
  id: string;
  name: string;
  styleProperties: any;
  isDefault: boolean;
}

interface Clip {
  id: string;
  title: string;
  description: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  seoScore: number;
  reason: string;
  clipCaptionsJson: any[];
  captionStyleId: string | null;
  status: string; // 'pending' | 'rendering' | 'rendered' | 'failed'
  renderedVideoUrl: string | null;
}

export default function ProjectWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;

  const [project, setProject] = useState<Project | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [captionStyles, setCaptionStyles] = useState<CaptionStyle[]>([]);
  const [selectedClip, setSelectedClip] = useState<Clip | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renderingStates, setRenderingStates] = useState<Record<string, boolean>>({});

  const fetchProjectData = async () => {
    try {
      setIsLoading(true);
      const [projRes, clipsRes, stylesRes] = await Promise.all([
        fetch(`/api/projects`), 
        fetch(`/api/clips?projectId=${projectId}`),
        fetch(`/api/styles`),
      ]);

      if (projRes.ok && clipsRes.ok && stylesRes.ok) {
        const projData = await projRes.json();
        const clipsData = await clipsRes.json();
        const stylesData = await stylesRes.json();

        const activeProj = projData.projects.find((p: any) => p.id === projectId);
        if (!activeProj) {
          setError("Project not found.");
          return;
        }

        setProject(activeProj);
        setClips(clipsData.clips || []);
        setCaptionStyles(stylesData.styles || []);

        if (clipsData.clips && clipsData.clips.length > 0) {
          setSelectedClip(clipsData.clips[0]);
        }
      } else {
        setError("Failed to load workspace data.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectData();
  }, [projectId]);

  useEffect(() => {
    const hasRenderingClips = clips.some((c) => c.status === "rendering");
    if (!hasRenderingClips) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/clips?projectId=${projectId}`);
        if (res.ok) {
          const data = await res.json();
          setClips(data.clips || []);
          
          if (selectedClip) {
            const updated = data.clips.find((c: any) => c.id === selectedClip.id);
            if (updated) setSelectedClip(updated);
          }
        }
      } catch (e) {
        console.error("Error polling clips status:", e);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [clips, projectId, selectedClip]);

  const [customStyleObjMap, setCustomStyleObjMap] = useState<Record<string, any>>({});

  const handleRenderClip = async (clipId: string) => {
    setRenderingStates((prev) => ({ ...prev, [clipId]: true }));
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          clipId,
          captionStyleId: selectedClip?.captionStyleId || undefined,
          customStyleProperties: customStyleObjMap[clipId] || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to start rendering.");
      }

      setClips((prev) =>
        prev.map((c) => (c.id === clipId ? { ...c, status: "rendering" } : c))
      );
      if (selectedClip && selectedClip.id === clipId) {
        setSelectedClip((prev) => (prev ? { ...prev, status: "rendering" } : null));
      }
    } catch (err: any) {
      alert(`Render error: ${err.message}`);
    } finally {
      setRenderingStates((prev) => ({ ...prev, [clipId]: false }));
    }
  };

  const [publishingStates, setPublishingStates] = useState<Record<string, boolean>>({});

  const handlePublishToYoutube = async (clipId: string) => {
    setPublishingStates((prev) => ({ ...prev, [clipId]: true }));
    try {
      const res = await fetch("/api/youtube/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clipId,
          privacyStatus: "public",
          customStyleProperties: customStyleObjMap[clipId] || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.details || data.error || "Failed to publish to YouTube Shorts.");
      }

      alert(`🎉 Published directly to YouTube Shorts!\nVideo ID: ${data.videoId}\nURL: ${data.youtubeUrl}`);
      
      setClips((prev) =>
        prev.map((c) => (c.id === clipId ? { ...c, status: "rendered", youtubeVideoId: data.videoId } : c))
      );
      if (selectedClip && selectedClip.id === clipId) {
        setSelectedClip((prev) => (prev ? { ...prev, status: "rendered", youtubeVideoId: data.videoId } : null));
      }
    } catch (err: any) {
      alert(`YouTube Upload Error: ${err.message}`);
    } finally {
      setPublishingStates((prev) => ({ ...prev, [clipId]: false }));
    }
  };

  const handleStyleChange = (styleId: string, styleProperties?: any) => {
    if (selectedClip) {
      setSelectedClip((prev) => (prev ? { ...prev, captionStyleId: styleId } : null));
      if (styleProperties) {
        setCustomStyleObjMap((prev) => ({
          ...prev,
          [selectedClip.id]: styleProperties,
        }));
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="h-10 w-10 text-yellow-500 animate-spin" />
        <p className="text-sm text-zinc-400">Loading workspace & clips...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="text-red-500 font-semibold text-lg">{error || "Project Not Found"}</div>
        <Link
          href="/dashboard"
          className="inline-flex items-center space-x-2 text-sm text-yellow-500 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Dashboard</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="border-b border-zinc-900 bg-zinc-950/60 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center space-x-4">
          <Link
            href="/dashboard"
            className="p-2 border border-zinc-900 hover:border-zinc-800 rounded-xl bg-zinc-900/20 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-md font-semibold text-zinc-100 truncate max-w-md">
              {project.title}
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Source: {project.youtubeSourceUrl ? "YouTube URL Ingestion" : "Local Raw Video"}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
            project.status === "ready" 
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
              : project.status === "failed" 
              ? "bg-red-500/10 text-red-400 border border-red-500/20"
              : "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 animate-pulse"
          }`}>
            {project.status === "ready" ? "AI Pipeline Completed" : `Status: ${project.status}`}
          </span>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 xl:grid-cols-3 gap-0 overflow-hidden">
        <div className="xl:col-span-2 p-8 overflow-y-auto border-r border-zinc-900">
          {project.status !== "ready" ? (
            <div className="py-20 text-center space-y-6">
              <div className="flex justify-center">
                <Loader2 className="h-12 w-12 text-yellow-500 animate-spin" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-zinc-200 uppercase tracking-wider">
                  AI analysis in progress
                </h2>
                <p className="text-sm text-zinc-500 max-w-sm mx-auto">
                  Deepgram is transcribing and Gemini AI is running viral scores to select the best clips. Please wait a few moments...
                </p>
              </div>
            </div>
          ) : selectedClip ? (
            <div className="space-y-8">
              <ClipPlayer
                videoUrl={project.originalVideoUrl}
                startTimeSeconds={selectedClip.startTimeSeconds}
                endTimeSeconds={selectedClip.endTimeSeconds}
                subtitles={selectedClip.clipCaptionsJson || []}
                captionStylesList={captionStyles}
                onStyleChange={handleStyleChange}
              />

              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-zinc-200">
                    Export & Direct Publishing
                  </h4>
                  <p className="text-xs text-zinc-400">
                    Compile vertical MP4 with captions or publish directly to YouTube Shorts without leaving the app.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* 1. Render MP4 or Download MP4 */}
                  {selectedClip.status === "rendered" && selectedClip.renderedVideoUrl ? (
                    <a
                      href={selectedClip.renderedVideoUrl}
                      download={`${selectedClip.title.replace(/\s+/g, "_")}.mp4`}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center space-x-2 transition"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download MP4</span>
                    </a>
                  ) : selectedClip.status === "rendering" ? (
                    <button
                      disabled
                      className="bg-zinc-800 text-zinc-400 text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center space-x-2 border border-zinc-700 animate-pulse"
                    >
                      <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
                      <span>Rendering MP4...</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleRenderClip(selectedClip.id)}
                      disabled={renderingStates[selectedClip.id]}
                      className="bg-yellow-500 hover:bg-yellow-600 text-zinc-950 text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center space-x-2 transition disabled:opacity-50"
                    >
                      {renderingStates[selectedClip.id] ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Video className="h-4 w-4" />
                      )}
                      <span>Render Clip</span>
                    </button>
                  )}

                  {/* 2. Direct YouTube Shorts Upload Button */}
                  {selectedClip.youtubeVideoId ? (
                    <a
                      href={`https://youtube.com/watch?v=${selectedClip.youtubeVideoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center space-x-2 transition"
                    >
                      <Youtube className="h-4 w-4 text-red-500" />
                      <span>View on YouTube Shorts</span>
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  ) : (
                    <button
                      onClick={() => handlePublishToYoutube(selectedClip.id)}
                      disabled={publishingStates[selectedClip.id]}
                      className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-5 py-2.5 rounded-xl flex items-center space-x-2 transition shadow-lg shadow-red-600/20 disabled:opacity-50"
                    >
                      {publishingStates[selectedClip.id] ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Youtube className="h-4 w-4" />
                      )}
                      <span>
                        {publishingStates[selectedClip.id]
                          ? "Uploading to YouTube..."
                          : "Direct Upload to YouTube"}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-20 text-center text-zinc-500 text-sm">
              No clips detected for this project.
            </div>
          )}
        </div>

        <div className="xl:col-span-1 p-6 bg-zinc-950/20 overflow-y-auto space-y-6">
          <div>
            <h2 className="text-md font-semibold text-zinc-200 flex items-center space-x-2">
              <Sparkles className="h-4 w-4 text-yellow-500" />
              <span>AI Clips Suggested ({clips.length})</span>
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Select a clip to review, change settings, and render.
            </p>
          </div>

          <div className="space-y-4">
            {clips.map((clip) => {
              const isActive = selectedClip?.id === clip.id;
              
              let scoreColor = "text-yellow-500 bg-yellow-500/10 border-yellow-500/20";
              if (clip.seoScore >= 90) scoreColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
              if (clip.seoScore < 70) scoreColor = "text-zinc-400 bg-zinc-500/10 border-zinc-500/20";

              return (
                <div
                  key={clip.id}
                  onClick={() => setSelectedClip(clip)}
                  className={`p-5 rounded-2xl border text-left cursor-pointer transition-all duration-300 space-y-4 ${
                    isActive
                      ? "border-yellow-500 bg-yellow-500/5 shadow-lg shadow-yellow-500/5"
                      : "border-zinc-900 hover:border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold text-zinc-100 line-clamp-2 leading-tight">
                      {clip.title}
                    </h3>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 inline-flex items-center space-x-0.5 ${scoreColor}`}>
                      <TrendingUp className="h-3 w-3" />
                      <span>{clip.seoScore}</span>
                    </span>
                  </div>

                  <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed">
                    {clip.description}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-zinc-500 border-t border-zinc-900/60 pt-3">
                    <span>
                      Range: {clip.startTimeSeconds.toFixed(1)}s - {clip.endTimeSeconds.toFixed(1)}s
                    </span>

                    <span className="inline-flex items-center space-x-1 font-semibold uppercase tracking-wider text-[9px]">
                      {clip.status === "rendered" ? (
                        <span className="text-emerald-400 flex items-center space-x-0.5">
                          <CheckCircle className="h-3 w-3" />
                          <span>Ready</span>
                        </span>
                      ) : clip.status === "rendering" ? (
                        <span className="text-yellow-500 flex items-center space-x-0.5 animate-pulse">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Rendering</span>
                        </span>
                      ) : (
                        <span className="text-zinc-500">Unrendered</span>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
