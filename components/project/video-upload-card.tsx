"use client";

import { useState, useRef } from "react";
import { Upload, Youtube, Loader2, Video, CheckCircle, AlertCircle } from "lucide-react";

interface VideoUploadCardProps {
  onUploadComplete: (project: any) => void;
}

export default function VideoUploadCard({ onUploadComplete }: VideoUploadCardProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState(""); // 'Uploading file...' | 'Downloading from YouTube...'
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await handleFileUpload(e.target.files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith("video/")) {
      setError("Please select a valid video file (MP4, QuickTime, etc.)");
      return;
    }

    // Max 2GB
    if (file.size > 2 * 1024 * 1024 * 1024) {
      setError("Video size exceeds the 2GB limit.");
      return;
    }

    setError(null);
    setIsProcessing(true);
    setProcessingStatus("Uploading file to local storage...");
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/projects", true);

      // Track progress
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percentComplete);
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          setProcessingStatus("Upload complete!");
          setTimeout(() => {
            onUploadComplete(response.project);
          }, 500);
        } else {
          const response = JSON.parse(xhr.responseText);
          setError(response.error || "Failed to upload video");
          setIsProcessing(false);
        }
      };

      xhr.onerror = () => {
        setError("Network error occurred during upload");
        setIsProcessing(false);
      };

      xhr.send(formData);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
      setIsProcessing(false);
    }
  };

  const handleYoutubeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;

    setError(null);
    setIsProcessing(true);
    setProcessingStatus("Downloading video from YouTube...");
    setUploadProgress(0);

    // Simulate progress bar movement for YouTube downloads (since download is backend side)
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + 5;
      });
    }, 1500);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ youtubeUrl }),
      });

      clearInterval(interval);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.details || "Failed to download YouTube video");
      }

      setUploadProgress(100);
      setProcessingStatus("YouTube download complete!");
      setTimeout(() => {
        onUploadComplete(data.project);
      }, 500);
    } catch (err: any) {
      clearInterval(interval);
      setError(err.message || "Failed to process YouTube link");
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-8">
          <h2 className="text-xl font-semibold text-zinc-100 mb-2">Ingest New Video</h2>
          <p className="text-sm text-zinc-400 mb-6">
            Upload a local MP4 file or paste a YouTube link to generate viral clips.
          </p>

          {!isProcessing ? (
            <div className="space-y-6">
              {/* Drag and drop upload card */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-300 ${
                  isDragActive
                    ? "border-yellow-500 bg-yellow-500/5"
                    : "border-zinc-800 hover:border-zinc-700 bg-zinc-950/40 hover:bg-zinc-950/80"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="video/*"
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center space-y-4">
                  <div className="p-4 bg-zinc-900 rounded-full border border-zinc-800 text-zinc-400">
                    <Upload className="h-8 w-8 text-zinc-300" />
                  </div>
                  <div>
                    <p className="text-sm text-zinc-200 font-medium">
                      Drag & drop your video here, or <span className="text-yellow-500 hover:underline">browse</span>
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">Supports MP4, MOV, AVI (Max 2GB)</p>
                  </div>
                </div>
              </div>

              {/* OR divider */}
              <div className="flex items-center justify-center space-x-4">
                <div className="h-px bg-zinc-800 flex-1"></div>
                <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">or</span>
                <div className="h-px bg-zinc-800 flex-1"></div>
              </div>

              {/* YouTube link input */}
              <form onSubmit={handleYoutubeSubmit} className="space-y-3">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Youtube className="h-5 w-5 text-red-500" />
                  </div>
                  <input
                    type="url"
                    required
                    placeholder="Paste YouTube video URL here..."
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3.5 pl-12 pr-4 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 transition"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-medium py-3 rounded-xl transition text-sm flex items-center justify-center space-x-2"
                >
                  <Video className="h-4 w-4" />
                  <span>Fetch & Import Video</span>
                </button>
              </form>
            </div>
          ) : (
            // Processing/Uploading state UI
            <div className="py-8 text-center space-y-6">
              <div className="flex justify-center">
                <div className="relative flex items-center justify-center">
                  <Loader2 className="h-12 w-12 text-yellow-500 animate-spin" />
                  <Video className="h-5 w-5 text-zinc-300 absolute" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-zinc-200">{processingStatus}</p>
                <p className="text-xs text-zinc-500">Please do not close this window</p>
              </div>

              <div className="max-w-xs mx-auto space-y-2">
                <div className="w-full bg-zinc-950 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-yellow-500 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-zinc-500 px-1">
                  <span>Progress</span>
                  <span>{uploadProgress}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start space-x-3 text-red-400">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold">Error occurred</p>
                <p className="mt-0.5 text-red-400/80">{error}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
