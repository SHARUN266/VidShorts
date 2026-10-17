"use client";

import { Player, PlayerRef } from "@remotion/player";
import { ShortsComposition, SubtitleWord } from "@/remotion/ShortsComposition";
import { useState, useEffect, useRef } from "react";
import {
  Layers,
  ArrowUp,
  AlignJustify,
  ArrowDown,
  Type,
  Palette,
  Music,
  Volume2,
  Youtube,
  Loader2,
  CheckCircle2,
  Trash2,
  Play,
  Square,
  Library,
} from "lucide-react";

interface ClipPlayerProps {
  videoUrl: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  subtitles: SubtitleWord[];
  initialStyle?: {
    fontFamily: string;
    fontSizePx: number;
    textColor: string;
    highlightColor: string;
    backgroundColor: string;
    textPosition: string;
    backgroundAudioUrl?: string;
    backgroundAudioVolume?: number;
    backgroundAudioTitle?: string;
  };
  captionStylesList: Array<{
    id: string;
    name: string;
    styleProperties: any;
    isDefault?: boolean;
  }>;
  onStyleChange?: (styleId: string, styleProperties?: any) => void;
}

export default function ClipPlayer({
  videoUrl,
  startTimeSeconds,
  endTimeSeconds,
  subtitles,
  initialStyle,
  captionStylesList = [],
  onStyleChange,
}: ClipPlayerProps) {
  const durationInSeconds = Math.max(1, endTimeSeconds - startTimeSeconds);
  const fps = 30;
  const durationInFrames = Math.round(durationInSeconds * fps);

  const defaultStyle = {
    fontFamily: "Impact, Arial Black, sans-serif",
    fontSizePx: 56,
    textColor: "#FFFFFF",
    highlightColor: "#EAB308",
    backgroundColor: "transparent",
    textPosition: "center",
    videoFilter: "none",
    backgroundAudioUrl: "",
    backgroundAudioVolume: 0.3,
    backgroundAudioTitle: "",
  };

  const [activeStyle, setActiveStyle] = useState(initialStyle || defaultStyle);
  const [selectedStyleId, setSelectedStyleId] = useState("");

  const [youtubeMusicUrlInput, setYoutubeMusicUrlInput] = useState("");
  const [isImportingMusic, setIsImportingMusic] = useState(false);
  const [musicImportError, setMusicImportError] = useState<string | null>(null);

  const [savedAudioTracks, setSavedAudioTracks] = useState<any[]>([]);
  const [isLoadingSavedTracks, setIsLoadingSavedTracks] = useState(false);
  const [previewTrackUrl, setPreviewTrackUrl] = useState<string | null>(null);
  const [previewAudioObj, setPreviewAudioObj] = useState<HTMLAudioElement | null>(null);

  const playerRef = useRef<PlayerRef>(null);
  const bgAudioRef = useRef<HTMLAudioElement | null>(null);

  const fetchSavedAudioTracks = async () => {
    try {
      setIsLoadingSavedTracks(true);
      const res = await fetch("/api/music/list");
      const data = await res.json();
      if (res.ok && data.tracks) {
        setSavedAudioTracks(data.tracks);
      }
    } catch (e) {
      console.error("Error fetching audio library:", e);
    } finally {
      setIsLoadingSavedTracks(false);
    }
  };

  useEffect(() => {
    fetchSavedAudioTracks();
  }, []);

  const updateStyleAndNotify = (newStyle: any, styleId = selectedStyleId) => {
    setActiveStyle(newStyle);
    if (onStyleChange) {
      onStyleChange(styleId, newStyle);
    }
  };

  const handleStyleSelect = (style: any, id: string) => {
    const properties = style.styleProperties || style;
    const updated = {
      ...properties,
      textPosition: activeStyle.textPosition || properties.textPosition || "center",
      videoFilter: activeStyle.videoFilter || properties.videoFilter || "none",
      backgroundAudioUrl: activeStyle.backgroundAudioUrl ?? properties.backgroundAudioUrl ?? "",
      backgroundAudioVolume: activeStyle.backgroundAudioVolume ?? properties.backgroundAudioVolume ?? 0.3,
      backgroundAudioTitle: activeStyle.backgroundAudioTitle ?? properties.backgroundAudioTitle ?? "",
    };
    setSelectedStyleId(id);
    updateStyleAndNotify(updated, id);
  };

  const handlePositionChange = (position: "top" | "center" | "bottom") => {
    const updated = {
      ...activeStyle,
      textPosition: position,
    };
    updateStyleAndNotify(updated);
  };

  const handleFontSizeChange = (sizePx: number) => {
    const updated = {
      ...activeStyle,
      fontSizePx: sizePx,
    };
    updateStyleAndNotify(updated);
  };

  const handleFilterChange = (filter: string) => {
    const updated = {
      ...activeStyle,
      videoFilter: filter,
    };
    updateStyleAndNotify(updated);
  };

  const handleImportYoutubeMusic = async () => {
    if (!youtubeMusicUrlInput.trim()) return;

    try {
      setIsImportingMusic(true);
      setMusicImportError(null);

      const res = await fetch("/api/music/youtube-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeUrl: youtubeMusicUrlInput.trim() }),
      });

      const data = await res.json();

      if (!res.ok || !data.audioUrl) {
        throw new Error(data.error || data.details || "Failed to extract audio track");
      }

      const updated = {
        ...activeStyle,
        backgroundAudioUrl: data.audioUrl,
        backgroundAudioVolume: activeStyle.backgroundAudioVolume ?? 0.3,
        backgroundAudioTitle: data.title || "YouTube Background Track",
      };

      updateStyleAndNotify(updated);
      setYoutubeMusicUrlInput("");

      if (data.track) {
        setSavedAudioTracks((prev) => [data.track, ...prev.filter((t) => t.id !== data.track.id)]);
      } else {
        fetchSavedAudioTracks();
      }

      // Play preview audio immediately
      setTimeout(() => {
        if (bgAudioRef.current) {
          bgAudioRef.current.currentTime = 0;
          bgAudioRef.current.volume = updated.backgroundAudioVolume;
          bgAudioRef.current.play().catch((err) => console.warn("Background audio play catch:", err));
        }
      }, 100);
    } catch (err: any) {
      console.error("Music import failed:", err);
      setMusicImportError(err.message || "Failed to import YouTube audio");
    } finally {
      setIsImportingMusic(false);
    }
  };

  const handleSelectSavedTrack = (track: any) => {
    if (previewAudioObj) {
      previewAudioObj.pause();
      setPreviewAudioObj(null);
      setPreviewTrackUrl(null);
    }
    const updated = {
      ...activeStyle,
      backgroundAudioUrl: track.audioUrl,
      backgroundAudioVolume: activeStyle.backgroundAudioVolume ?? 0.3,
      backgroundAudioTitle: track.title || "Background Track",
    };
    updateStyleAndNotify(updated);

    setTimeout(() => {
      if (bgAudioRef.current) {
        bgAudioRef.current.currentTime = 0;
        bgAudioRef.current.volume = updated.backgroundAudioVolume;
        bgAudioRef.current.play().catch(() => { });
      }
    }, 100);
  };

  const handleTogglePreviewTrack = (e: React.MouseEvent, trackUrl: string) => {
    e.stopPropagation();
    if (previewTrackUrl === trackUrl && previewAudioObj) {
      previewAudioObj.pause();
      setPreviewAudioObj(null);
      setPreviewTrackUrl(null);
    } else {
      if (previewAudioObj) previewAudioObj.pause();
      const fullUrl = trackUrl.startsWith("/") ? `${window.location.origin}${trackUrl}` : trackUrl;
      const audio = new Audio(fullUrl);
      audio.volume = activeStyle.backgroundAudioVolume ?? 0.3;
      audio.play().catch(() => { });
      setPreviewAudioObj(audio);
      setPreviewTrackUrl(trackUrl);
      audio.onended = () => {
        setPreviewAudioObj(null);
        setPreviewTrackUrl(null);
      };
    }
  };

  const handleDeleteSavedTrack = async (e: React.MouseEvent, track: any) => {
    e.stopPropagation();
    try {
      const res = await fetch("/api/music/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId: track.id, audioUrl: track.audioUrl }),
      });
      if (res.ok) {
        setSavedAudioTracks((prev) => prev.filter((t) => t.id !== track.id));
        if (activeStyle.backgroundAudioUrl === track.audioUrl) {
          handleClearMusic();
        }
      }
    } catch (err) {
      console.error("Delete track error:", err);
    }
  };

  const handleVolumeChange = (vol: number) => {
    const updated = {
      ...activeStyle,
      backgroundAudioVolume: vol,
    };
    updateStyleAndNotify(updated);

    if (bgAudioRef.current) {
      bgAudioRef.current.volume = vol;
    }
  };

  const handleClearMusic = () => {
    if (bgAudioRef.current) {
      bgAudioRef.current.pause();
    }
    const updated = {
      ...activeStyle,
      backgroundAudioUrl: "",
      backgroundAudioTitle: "",
    };
    updateStyleAndNotify(updated);
  };

  // Sync volume change to background audio HTML5 element
  useEffect(() => {
    if (bgAudioRef.current) {
      bgAudioRef.current.volume = activeStyle.backgroundAudioVolume ?? 0.3;
    }
  }, [activeStyle.backgroundAudioVolume]);

  // Sync play/pause/seek events from Remotion Player to background HTML5 audio element
  useEffect(() => {
    let attachedPlayer: PlayerRef | null = null;
    let onPlay: (() => void) | null = null;
    let onPause: (() => void) | null = null;
    let onSeek: (() => void) | null = null;

    const checkAndAttach = () => {
      const player = playerRef.current;
      if (player && !attachedPlayer) {
        attachedPlayer = player;
        onPlay = () => {
          if (bgAudioRef.current && activeStyle.backgroundAudioUrl) {
            bgAudioRef.current.play().catch(() => { });
          }
        };
        onPause = () => {
          if (bgAudioRef.current) {
            bgAudioRef.current.pause();
          }
        };
        onSeek = () => {
          if (bgAudioRef.current) {
            bgAudioRef.current.currentTime = 0;
          }
        };
        player.addEventListener("play", onPlay);
        player.addEventListener("pause", onPause);
        player.addEventListener("seeked", onSeek);
      }
    };

    const interval = setInterval(checkAndAttach, 250);

    return () => {
      clearInterval(interval);
      if (attachedPlayer) {
        if (onPlay) attachedPlayer.removeEventListener("play", onPlay);
        if (onPause) attachedPlayer.removeEventListener("pause", onPause);
        if (onSeek) attachedPlayer.removeEventListener("seeked", onSeek);
      }
    };
  }, [activeStyle.backgroundAudioUrl]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
      {/* Background Audio HTML5 Element for guaranteed browser player audio sync */}
      {activeStyle.backgroundAudioUrl && (
        <audio
          ref={bgAudioRef}
          src={
            activeStyle.backgroundAudioUrl.startsWith("/")
              ? `${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}${activeStyle.backgroundAudioUrl}`
              : activeStyle.backgroundAudioUrl
          }
          loop
        />
      )}

      {/* 1. Left Side: Remotion Preview Player */}
      <div className="lg:col-span-3 flex justify-center">
        <div className="relative w-full max-w-[320px] bg-zinc-950 border border-zinc-800 rounded-[32px] overflow-hidden shadow-2xl p-3.5 ring-1 ring-zinc-800/50">
          {/* Top Speaker/Notch Detail */}
          <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-28 h-5 bg-zinc-950 rounded-full z-20 flex items-center justify-center border-b border-zinc-900">
            <div className="w-12 h-1 bg-zinc-800 rounded-full"></div>
          </div>

          <div className="relative w-full aspect-[9/16] rounded-[24px] overflow-hidden bg-black ring-1 ring-zinc-900">
            {videoUrl ? (
              <Player
                ref={playerRef}
                component={ShortsComposition}
                inputProps={{
                  videoUrl,
                  startTimeSeconds,
                  durationInSeconds,
                  subtitles,
                  styleProperties: activeStyle,
                }}
                durationInFrames={durationInFrames}
                fps={fps}
                compositionWidth={1080}
                compositionHeight={1920}
                style={{
                  width: "100%",
                  height: "100%",
                }}
                controls
                loop
                audioVolume={1}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 bg-zinc-950">
                <p className="text-sm font-medium">No video source loaded</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Right Side: Caption Styles & Position Controls Panel */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6">
          {/* YouTube Background Music Import & Mixing Panel */}
          <div className="space-y-3 pb-4 border-b border-zinc-800">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center space-x-2">
                <Music className="h-4 w-4 text-yellow-500" />
                <span>Background Music Import</span>
              </span>
              {activeStyle.backgroundAudioUrl && (
                <span className="text-[10px] text-yellow-400 font-mono bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/20 flex items-center space-x-1">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Music Active</span>
                </span>
              )}
            </h3>

            {/* YouTube Audio Link Input & Button */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
                  <input
                    type="text"
                    placeholder="Paste YouTube Video URL for background audio..."
                    value={youtubeMusicUrlInput}
                    onChange={(e) => setYoutubeMusicUrlInput(e.target.value)}
                    disabled={isImportingMusic}
                    className="w-full bg-zinc-950/70 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-yellow-500/50 disabled:opacity-50"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleImportYoutubeMusic}
                  disabled={isImportingMusic || !youtubeMusicUrlInput.trim()}
                  className="px-3.5 py-2 bg-yellow-500 hover:bg-yellow-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-black text-xs font-bold rounded-xl transition flex items-center space-x-1.5 flex-shrink-0"
                >
                  {isImportingMusic ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Extracting...</span>
                    </>
                  ) : (
                    <span>Import Audio</span>
                  )}
                </button>
              </div>

              {musicImportError && (
                <p className="text-xs text-red-400 font-medium">{musicImportError}</p>
              )}
            </div>

            {/* Active Track Status & Volume Mixer Controls */}
            {activeStyle.backgroundAudioUrl ? (
              <div className="space-y-2.5 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 truncate pr-2">
                    <Music className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0" />
                    <span className="text-xs font-semibold text-zinc-200 truncate">
                      {activeStyle.backgroundAudioTitle || "YouTube Audio Track"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearMusic}
                    title="Remove background music"
                    className="p-1 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-900 transition flex-shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Volume Level Slider */}
                <div className="flex items-center space-x-3 pt-1 border-t border-zinc-900">
                  <Volume2 className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                  <span className="text-[11px] font-medium text-zinc-400 flex-shrink-0">Volume:</span>
                  <input
                    type="range"
                    min="0.05"
                    max="1.00"
                    step="0.05"
                    value={activeStyle.backgroundAudioVolume ?? 0.3}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-full accent-yellow-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                  />
                  <span className="text-xs font-mono text-yellow-400 flex-shrink-0 font-semibold">
                    {Math.round((activeStyle.backgroundAudioVolume ?? 0.3) * 100)}%
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-zinc-500">
                Paste any YouTube song or background beat URL to automatically extract audio track & mix into video.
              </p>
            )}

            {/* Previously Saved Audio Library List */}
            <div className="space-y-2 pt-2 border-t border-zinc-800/80">
              <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center space-x-1.5">
                <Library className="h-3.5 w-3.5 text-yellow-500" />
                <span>Previously Imported Audio Library ({savedAudioTracks.length})</span>
              </h4>

              {isLoadingSavedTracks ? (
                <div className="py-3 text-center text-xs text-zinc-500 flex items-center justify-center space-x-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-yellow-500" />
                  <span>Loading saved audio tracks...</span>
                </div>
              ) : savedAudioTracks.length > 0 ? (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {savedAudioTracks.map((track) => {
                    const isSelected = activeStyle.backgroundAudioUrl === track.audioUrl;
                    const isPreviewing = previewTrackUrl === track.audioUrl;

                    return (
                      <div
                        key={track.id}
                        onClick={() => handleSelectSavedTrack(track)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs transition cursor-pointer ${isSelected
                            ? "border-yellow-500 bg-yellow-500/10 text-yellow-400 font-semibold shadow-sm"
                            : "border-zinc-800/80 hover:border-zinc-700 bg-zinc-950/40 text-zinc-300 hover:bg-zinc-950"
                          }`}
                      >
                        <div className="flex items-center space-x-2 truncate pr-2 flex-1">
                          <Music className={`h-3.5 w-3.5 flex-shrink-0 ${isSelected ? "text-yellow-400" : "text-zinc-500"}`} />
                          <span className="truncate text-xs">{track.title}</span>
                        </div>

                        <div className="flex items-center space-x-1 flex-shrink-0">
                          {/* Sample Preview Play/Pause button */}
                          <button
                            type="button"
                            onClick={(e) => handleTogglePreviewTrack(e, track.audioUrl)}
                            title="Play sample preview"
                            className={`p-1.5 rounded-lg border transition ${isPreviewing
                                ? "bg-yellow-500 text-black border-yellow-400 animate-pulse"
                                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
                              }`}
                          >
                            {isPreviewing ? (
                              <Square className="h-3 w-3 fill-current" />
                            ) : (
                              <Play className="h-3 w-3 fill-current" />
                            )}
                          </button>

                          {/* Delete from library button */}
                          <button
                            type="button"
                            onClick={(e) => handleDeleteSavedTrack(e, track)}
                            title="Delete track from library"
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-900 transition"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-zinc-600 italic py-1">
                  No saved background tracks yet. Import a YouTube music URL above to build your audio library!
                </p>
              )}
            </div>
          </div>

          {/* Caption Position Controls */}
          <div className="space-y-3 pb-4 border-b border-zinc-800">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center space-x-2">
              <AlignJustify className="h-4 w-4 text-yellow-500" />
              <span>Caption Screen Position</span>
            </h3>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handlePositionChange("top")}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-1.5 transition ${activeStyle.textPosition === "top"
                  ? "border-yellow-500 bg-yellow-500/10 text-yellow-400 shadow-md shadow-yellow-500/5"
                  : "border-zinc-800 hover:border-zinc-700 bg-zinc-950/40 text-zinc-400"
                  }`}
              >
                <ArrowUp className="h-3.5 w-3.5" />
                <span>Top</span>
              </button>

              <button
                type="button"
                onClick={() => handlePositionChange("center")}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-1.5 transition ${activeStyle.textPosition === "center"
                  ? "border-yellow-500 bg-yellow-500/10 text-yellow-400 shadow-md shadow-yellow-500/5"
                  : "border-zinc-800 hover:border-zinc-700 bg-zinc-950/40 text-zinc-400"
                  }`}
              >
                <AlignJustify className="h-3.5 w-3.5" />
                <span>Center</span>
              </button>

              <button
                type="button"
                onClick={() => handlePositionChange("bottom")}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-1.5 transition ${activeStyle.textPosition === "bottom"
                  ? "border-yellow-500 bg-yellow-500/10 text-yellow-400 shadow-md shadow-yellow-500/5"
                  : "border-zinc-800 hover:border-zinc-700 bg-zinc-950/40 text-zinc-400"
                  }`}
              >
                <ArrowDown className="h-3.5 w-3.5" />
                <span>Bottom</span>
              </button>
            </div>
          </div>

          {/* Font Size Selector */}
          <div className="space-y-3 pb-4 border-b border-zinc-800">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center space-x-2">
              <Type className="h-4 w-4 text-yellow-500" />
              <span>Subtitle Font Size</span>
            </h3>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleFontSizeChange(44)}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold transition ${activeStyle.fontSizePx === 44
                  ? "border-yellow-500 bg-yellow-500/10 text-yellow-400"
                  : "border-zinc-800 hover:border-zinc-700 bg-zinc-950/40 text-zinc-400"
                  }`}
              >
                Small (44px)
              </button>

              <button
                type="button"
                onClick={() => handleFontSizeChange(56)}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold transition ${activeStyle.fontSizePx === 56 || (!activeStyle.fontSizePx)
                  ? "border-yellow-500 bg-yellow-500/10 text-yellow-400"
                  : "border-zinc-800 hover:border-zinc-700 bg-zinc-950/40 text-zinc-400"
                  }`}
              >
                Medium (56px)
              </button>

              <button
                type="button"
                onClick={() => handleFontSizeChange(68)}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold transition ${activeStyle.fontSizePx === 68
                  ? "border-yellow-500 bg-yellow-500/10 text-yellow-400"
                  : "border-zinc-800 hover:border-zinc-700 bg-zinc-950/40 text-zinc-400"
                  }`}
              >
                Large (68px)
              </button>
            </div>
          </div>

          {/* Video Color Filters Selector */}
          <div className="space-y-3 pb-4 border-b border-zinc-800">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center space-x-2">
              <Palette className="h-4 w-4 text-yellow-500" />
              <span>Video Color Filters</span>
            </h3>

            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "none", label: "Original" },
                { id: "vivid", label: "Vivid Boost" },
                { id: "cinematic", label: "Cinematic" },
                { id: "warm", label: "Warm Retro" },
                { id: "grayscale", label: "B & W" },
                { id: "neon", label: "Neon Teal" },
              ].map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => handleFilterChange(filter.id)}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-semibold transition ${(activeStyle.videoFilter || "none") === filter.id
                    ? "border-yellow-500 bg-yellow-500/10 text-yellow-400 shadow-md shadow-yellow-500/5"
                    : "border-zinc-800 hover:border-zinc-700 bg-zinc-950/40 text-zinc-400"
                    }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preset Styles Header */}
          <div>
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center space-x-2">
              <Layers className="h-4 w-4 text-yellow-500" />
              <span>Burn Preset Themes</span>
            </h3>
            <p className="text-[11px] text-zinc-500 mt-1">
              Select one of the 9 viral font themes.
            </p>
          </div>

          {/* Quick style select cards list */}
          <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
            {captionStylesList.map((style) => (
              <button
                key={style.id}
                type="button"
                onClick={() => handleStyleSelect(style, style.id)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all duration-300 flex items-center justify-between ${selectedStyleId === style.id ||
                  (!selectedStyleId && style.isDefault)
                  ? "border-yellow-500 bg-yellow-500/5 shadow-md shadow-yellow-500/5"
                  : "border-zinc-800 hover:border-zinc-700 bg-zinc-950/40 hover:bg-zinc-950/70"
                  }`}
              >
                <div>
                  <p className="text-xs font-semibold text-zinc-200">{style.name}</p>
                </div>

                {/* Micro Preview Circle */}
                <div
                  className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider"
                  style={{
                    fontFamily: style.styleProperties?.fontFamily || "sans-serif",
                    color: style.styleProperties?.highlightColor || "#FFF",
                    backgroundColor: "rgba(0, 0, 0, 0.4)",
                    border: `1px solid ${style.styleProperties?.textColor || "#FFF"}`
                  }}
                >
                  Subtitles
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
