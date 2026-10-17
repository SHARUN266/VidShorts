"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import VideoUploadCard from "@/components/project/video-upload-card";
import { Video, Calendar, ArrowRight, FolderOpen, RefreshCw, Trash2 } from "lucide-react";

interface Project {
  id: string;
  title: string;
  originalVideoUrl: string;
  youtubeSourceUrl: string | null;
  status: string;
  createdAt: string;
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProjects = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (res.ok) {
        setProjects(data.projects || []);
      }
    } catch (err) {
      console.error("Failed to load projects", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm("Are you sure you want to delete this project and all its clips?")) {
      return;
    }
    try {
      const res = await fetch(`/api/projects?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== id));
      } else {
        alert("Failed to delete project");
      }
    } catch (err) {
      console.error("Error deleting project:", err);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleUploadComplete = (newProject: Project) => {
    // Reload projects list to show the new project immediately
    fetchProjects();
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-900 bg-zinc-950 p-6 flex flex-col justify-between hidden md:flex">
        <div className="space-y-8">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 bg-yellow-500 rounded-xl flex items-center justify-center font-bold text-zinc-950 text-lg shadow-lg shadow-yellow-500/10">
              VS
            </div>
            <span className="font-bold text-xl tracking-tight text-zinc-100">
              VidShot<span className="text-yellow-500">.</span>
            </span>
          </div>

          {/* Navigation */}
          <nav className="space-y-1">
            <Link
              href="/dashboard"
              className="flex items-center space-x-3 px-4 py-3 bg-zinc-900/60 border border-zinc-800 rounded-xl text-zinc-200 text-sm font-medium transition"
            >
              <Video className="h-4 w-4 text-yellow-500" />
              <span>Dashboard</span>
            </Link>
            <Link
              href="/videos"
              className="flex items-center space-x-3 px-4 py-3 hover:bg-zinc-900/40 rounded-xl text-zinc-400 hover:text-zinc-200 text-sm font-medium transition"
            >
              <FolderOpen className="h-4 w-4" />
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
      <main className="flex-1 p-8 overflow-y-auto max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Personal Dashboard</h1>
            <p className="text-sm text-zinc-500 mt-1">Manage and cut your video clips locally.</p>
          </div>
          <button
            onClick={fetchProjects}
            className="p-2 border border-zinc-800 rounded-lg bg-zinc-900/40 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition"
            title="Refresh List"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Phase 2 Video Ingestion UI */}
        <div className="mb-12">
          <VideoUploadCard onUploadComplete={handleUploadComplete} />
        </div>

        {/* Recent Projects Table */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-zinc-200 mb-6 flex items-center space-x-2">
            <FolderOpen className="h-5 w-5 text-zinc-400" />
            <span>Recent Projects</span>
          </h2>

          {isLoading ? (
            <div className="py-12 text-center text-sm text-zinc-500 flex flex-col items-center justify-center space-y-3">
              <LoaderIcon className="h-6 w-6 animate-spin text-zinc-600" />
              <span>Loading projects...</span>
            </div>
          ) : projects.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-950/20">
              <p className="text-sm text-zinc-400">No projects created yet</p>
              <p className="text-xs text-zinc-600 mt-1">Upload a video or paste a YouTube link above to start.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 text-xs font-semibold uppercase">
                    <th className="py-3 px-4">Title</th>
                    <th className="py-3 px-4">Source URL</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Created At</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850">
                  {projects.map((project) => (
                    <tr key={project.id} className="hover:bg-zinc-900/30 transition-colors">
                      <td className="py-4 px-4 font-medium text-zinc-200">{project.title}</td>
                      <td className="py-4 px-4 text-zinc-500 font-mono text-xs truncate max-w-xs">
                        {project.youtubeSourceUrl || "Local Upload"}
                      </td>
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                          {project.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-zinc-400 text-xs">
                        {new Date(project.createdAt).toLocaleString()}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end space-x-3">
                          <Link 
                            href={`/projects/${project.id}`}
                            className="text-xs font-semibold text-zinc-400 hover:text-yellow-500 inline-flex items-center space-x-1 transition group"
                          >
                            <span>View Clips</span>
                            <ArrowRight className="h-3 w-3 transform group-hover:translate-x-0.5 transition" />
                          </Link>

                          <button
                            onClick={() => handleDeleteProject(project.id)}
                            title="Delete project"
                            className="p-1.5 rounded-lg border border-zinc-800 hover:border-red-500/50 bg-zinc-900/50 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function LoaderIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      ></circle>
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
  );
}
