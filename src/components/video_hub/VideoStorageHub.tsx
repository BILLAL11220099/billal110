import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Upload, Play, Trash2, Search, X, Film, Loader2, Sparkles, 
  AlertTriangle, Check, SlidersHorizontal, ArrowUpDown, Clock, 
  HardDrive, User, Info, FolderPlus, PlayCircle, Eye, ChevronRight
} from "lucide-react";
import { VideoMetadata, UserSession } from "../../types";
import { ref, uploadBytesResumable, getDownloadURL, getStorage, uploadBytes } from "firebase/storage";
import { db, storage } from "../../data/firebase";
import { saveVideoMetadataDoc, deleteVideoMetadataDoc } from "../../data/firebaseSync";
import VideoPlayer from "./VideoPlayer";

interface VideoStorageHubProps {
  videos: VideoMetadata[];
  currentSession: UserSession | null;
}

export default function VideoStorageHub({ videos, currentSession }: VideoStorageHubProps) {
  // Navigation & filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "size" | "uploader">("newest");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // Selection states
  const [activeVideo, setActiveVideo] = useState<VideoMetadata | null>(null);
  const [selectedDetailsVideo, setSelectedDetailsVideo] = useState<VideoMetadata | null>(null);

  // Upload modal & process states
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [uploadState, setUploadState] = useState<"idle" | "generating_meta" | "uploading" | "success" | "error">("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadErrorMsg, setUploadErrorMsg] = useState("");
  const [uploadSpeed, setUploadSpeed] = useState(""); // KB/s
  const [uploadEta, setUploadEta] = useState(""); // seconds remaining
  const [uploadTask, setUploadTask] = useState<any>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Error notifications (Toasts)
  const [toasts, setToasts] = useState<{ id: string; type: "success" | "error" | "info"; msg: string }[]>([]);

  // Delete confirmations
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Trigger custom notification alerts
  const triggerToast = (type: "success" | "error" | "info", msg: string) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, msg }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  // Helper formatting routines
  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (isoString: string) => {
    if (!isoString) return "N/A";
    return new Date(isoString).toLocaleDateString([], { 
      year: "numeric", 
      month: "short", 
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // Helper to standardise duration timing
  const formatDuration = (secs: number): string => {
    if (isNaN(secs) || secs === Infinity || secs < 0) return "00:00";
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const remainingSecs = Math.floor(secs % 60);
    
    const pad = (n: number) => n.toString().padStart(2, "0");
    if (hrs > 0) {
      return `${hrs}:${pad(mins)}:${pad(remainingSecs)}`;
    }
    return `${pad(mins)}:${pad(remainingSecs)}`;
  };

  // Extract duration & auto-generate a thumbnail snapshot in the browser
  const processVideoMetadataInBrowser = (file: File): Promise<{ duration: string; thumbnailBlob: Blob | null }> => {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;

      const objectUrl = URL.createObjectURL(file);
      video.src = objectUrl;

      // When metadata is parsed, grab duration & seek for frame extraction
      video.onloadedmetadata = () => {
        // seek to 1 second (or 10% in if video is extremely short) to capture a reliable thumbnail frame
        video.currentTime = Math.min(1.5, video.duration / 3);
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement("canvas");
          // Maintain a clean landscape 16:9 aspect ratio standard for thumbnails
          canvas.width = 640;
          canvas.height = 360;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(
              (blob) => {
                URL.revokeObjectURL(objectUrl);
                resolve({
                  duration: formatDuration(video.duration),
                  thumbnailBlob: blob
                });
              },
              "image/jpeg",
              0.85
            );
          } else {
            URL.revokeObjectURL(objectUrl);
            resolve({ duration: "0:00", thumbnailBlob: null });
          }
        } catch (err) {
          console.error("In-browser thumbnail rendering failed:", err);
          URL.revokeObjectURL(objectUrl);
          resolve({ duration: "0:00", thumbnailBlob: null });
        }
      };

      video.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({ duration: "0:00", thumbnailBlob: null });
      };
    });
  };

  // Drag operations
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    const allowedExtensions = ["mp4", "mov", "webm", "avi", "mkv"];
    const ext = file.name.split(".").pop()?.toLowerCase();
    
    if (!ext || !allowedExtensions.includes(ext)) {
      triggerToast("error", `Unsupported format! Please upload MP4, MOV, WEBM, AVI or MKV.`);
      return;
    }

    if (file.size > 500 * 1024 * 1024) { // 500MB
      triggerToast("error", "The video exceeds the 500MB storage limit.");
      return;
    }

    setUploadFile(file);
    if (!uploadTitle) {
      // Auto-populate Title without extension dots
      const cleanName = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
      setUploadTitle(cleanName);
    }
  };

  const startResumableUpload = async () => {
    if (!uploadFile) return;

    setUploadState("generating_meta");
    setUploadProgress(0);
    setIsPaused(false);

    try {
      // 1. Process Metatags & generate live Canvas thumbnail in the browser
      const { duration, thumbnailBlob } = await processVideoMetadataInBrowser(uploadFile);
      
      setUploadState("uploading");
      const videoId = crypto.randomUUID();
      const timestamp = Date.now();
      
      // Filename prevention of duplicates
      const safeFilename = `${timestamp}_${uploadFile.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const videoStorageRef = ref(storage, `videos/${videoId}/${safeFilename}`);

      // 2. Setup Resumable Upload Task
      const task = uploadBytesResumable(videoStorageRef, uploadFile);
      setUploadTask(task);

      let startTime = Date.now();
      let lastTransferred = 0;

      task.on(
        "state_changed",
        (snapshot) => {
          const progressPercent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progressPercent);

          // Speed & ETA calculations
          const currentTime = Date.now();
          const ellapsedTimeSecs = (currentTime - startTime) / 1000;
          if (ellapsedTimeSecs > 0.5) {
            const bytesPerSec = (snapshot.bytesTransferred - lastTransferred) / ellapsedTimeSecs;
            const speedKb = bytesPerSec / 1024;
            setUploadSpeed(speedKb > 1024 ? `${(speedKb / 1024).toFixed(1)} MB/s` : `${Math.round(speedKb)} KB/s`);
            
            const remainingBytes = snapshot.totalBytes - snapshot.bytesTransferred;
            const etaVal = bytesPerSec > 0 ? Math.round(remainingBytes / bytesPerSec) : 0;
            setUploadEta(etaVal > 60 ? `${Math.floor(etaVal / 60)}m ${etaVal % 60}s` : `${etaVal}s`);

            // Reset loop
            startTime = currentTime;
            lastTransferred = snapshot.bytesTransferred;
          }
        },
        (error) => {
          console.error("Video chunked transfer error:", error);
          setUploadState("error");
          setUploadErrorMsg(error.message || "An interrupted connection or quota limit prevented the upload.");
          triggerToast("error", `Upload failed: ${error.message}`);
        },
        async () => {
          // Upload complete! Let's get secure playback public URLs
          try {
            const videoUrl = await getDownloadURL(task.snapshot.ref);
            let finalThumbnailUrl = "";

            // Upload the generated thumbnail frame if successful
            if (thumbnailBlob) {
              const thumbRef = ref(storage, `videos/${videoId}/thumb.jpg`);
              await uploadBytes(thumbRef, thumbnailBlob);
              finalThumbnailUrl = await getDownloadURL(thumbRef);
            }

            // Assemble compliant database payload
            const metadata: VideoMetadata = {
              id: videoId,
              title: uploadTitle.trim() || uploadFile.name,
              filename: uploadFile.name,
              description: uploadDescription.trim() || "No training walkthrough description provided.",
              storagePath: videoStorageRef.fullPath,
              thumbnailUrl: finalThumbnailUrl || "https://images.unsplash.com/photo-1590608897129-79da98d15969?auto=format&fit=crop&w=640&q=80",
              videoUrl: videoUrl,
              uploadedBy: currentSession?.username || "Authorized Crew Member",
              uploadedAt: new Date().toISOString(),
              fileSize: uploadFile.size,
              duration: duration,
              status: "ready"
            };

            await saveVideoMetadataDoc(metadata);
            
            setUploadState("success");
            triggerToast("success", `Video "${metadata.title}" is now instantly available storewide!`);
            
            // Clean modal states
            setTimeout(() => {
              setIsUploadModalOpen(false);
              cleanupForm();
            }, 1500);

          } catch (dbErr: any) {
            console.error("Firestore serialization failure:", dbErr);
            setUploadState("error");
            setUploadErrorMsg("Database registration failed on public cluster.");
          }
        }
      );

    } catch (metaErr: any) {
      console.error("Metadata generation issue:", metaErr);
      setUploadState("error");
      setUploadErrorMsg("Failed to decode video container settings in this browser.");
    }
  };

  const handlePauseResume = () => {
    if (!uploadTask) return;
    if (isPaused) {
      uploadTask.resume();
      setIsPaused(false);
    } else {
      uploadTask.pause();
      setIsPaused(true);
    }
  };

  const handleCancelUpload = () => {
    if (uploadTask) {
      uploadTask.cancel();
    }
    cleanupForm();
  };

  const cleanupForm = () => {
    setUploadTitle("");
    setUploadDescription("");
    setUploadFile(null);
    setUploadTask(null);
    setUploadState("idle");
    setUploadProgress(0);
    setIsPaused(false);
  };

  const executeDelete = async (id: string, storagePath: string) => {
    setDeletingId(id);
    try {
      // 1. Storage files are deleted from the sync engine cleanly
      await deleteVideoMetadataDoc(id, storagePath);
      triggerToast("success", "Video and all cloud cache data purged successfully.");
      if (selectedDetailsVideo?.id === id) {
        setSelectedDetailsVideo(null);
      }
    } catch (err: any) {
      console.error("Critical purge error:", err);
      triggerToast("error", `Storage deletion rule failed: ${err.message}`);
    } finally {
      setDeletingId(null);
      setDeleteConfirmId(null);
    }
  };

  // Search & sorting implementation
  const filteredVideos = videos.filter((v) => {
    const titleMatch = v.title.toLowerCase().includes(searchTerm.toLowerCase());
    const descMatch = v.description.toLowerCase().includes(searchTerm.toLowerCase());
    const authorMatch = v.uploadedBy.toLowerCase().includes(searchTerm.toLowerCase());
    if (filterCategory === "all") return titleMatch || descMatch || authorMatch;
    return (titleMatch || descMatch || authorMatch) && v.status === filterCategory;
  });

  const sortedVideos = [...filteredVideos].sort((a, b) => {
    if (sortBy === "newest") {
      return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
    }
    if (sortBy === "oldest") {
      return new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
    }
    if (sortBy === "size") {
      return b.fileSize - a.fileSize;
    }
    if (sortBy === "uploader") {
      return a.uploadedBy.localeCompare(b.uploadedBy);
    }
    return 0;
  });

  // Calculate Metrics
  const totalDurationSum = () => {
    return videos.length;
  };

  const totalStorageSizeStr = () => {
    const sum = videos.reduce((acc, curr) => acc + (curr.fileSize || 0), 0);
    return formatBytes(sum);
  };

  return (
    <div className="bg-slate-50 rounded-3xl min-h-screen pb-12">
      
      {/* Toast Alert stack notifications */}
      <div className="fixed top-20 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 80, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.9 }}
              className={`px-4.5 py-3 rounded-2xl shadow-xl flex items-center gap-3 backdrop-blur-md pointer-events-auto border font-bold text-xs uppercase tracking-wide ${
                t.type === "success" 
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                  : t.type === "error" 
                    ? "bg-red-50 border-red-200 text-red-800"
                    : "bg-slate-800 border-slate-700 text-white"
              }`}
            >
              {t.type === "success" && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
              {t.type === "error" && <AlertTriangle className="w-4 h-4 text-[#DA291C] shrink-0" />}
              <span className="leading-tight">{t.msg}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Top Banner and Header Grid */}
      <div className="bg-gradient-to-r from-red-600 via-[#DA291C] to-red-750 px-6 py-10 md:py-14 rounded-t-3xl shadow-md text-white text-left relative overflow-hidden">
        {/* Background art decor */}
        <div className="absolute right-0 top-0 w-80 h-80 bg-white/5 rounded-full blur-3xl -translate-y-16 translate-x-16"></div>
        <div className="absolute left-1/3 bottom-0 w-96 h-24 bg-yellow-400/10 rounded-full blur-2xl"></div>

        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 bg-black/15 border border-white/20 w-max px-3 py-1 rounded-full text-xs font-mono font-bold tracking-widest text-[#FFC72C] uppercase mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Full-Stack Cloud Center</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter leading-none mb-2">Shift Training & Walkthrough Hub</h1>
            <p className="text-sm md:text-base text-red-100 max-w-xl font-medium leading-relaxed">
              Instantly view, stream, and manage video assembly briefs, equipment calibration routines, and handwashing safety standards directly from fast cloud-accelerated CDNs.
            </p>
          </div>

          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="bg-white hover:bg-slate-100 text-[#DA291C] font-black px-6 py-4 rounded-2xl flex items-center justify-center gap-2.5 shadow-lg active:scale-97 hover:scale-[1.02] transition-all uppercase text-xs tracking-wider shrink-0 cursor-pointer"
          >
            <Upload className="w-4 h-4 stroke-[3px]" />
            Upload Compliance Video
          </button>
        </div>
      </div>

      {/* Operations Quick Metrics Panel */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 -mt-6 relative z-20">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4.5">
          
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4.5 text-left">
            <div className="w-12 h-12 bg-red-50 text-[#DA291C] rounded-xl flex items-center justify-center font-bold">
              <Film className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block">Total Catalog Items</span>
              <span className="text-2xl font-black text-slate-900 leading-none">{videos.length} videos</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4.5 text-left">
            <div className="w-12 h-12 bg-amber-50 text-amber-700 rounded-xl flex items-center justify-center font-bold">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block">Firebase Usage Est</span>
              <span className="text-2xl font-black text-slate-900 leading-none">{totalStorageSizeStr()}</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4.5 text-left">
            <div className="w-12 h-12 bg-blue-50 text-blue-700 rounded-xl flex items-center justify-center font-bold">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block">Deployment Speed</span>
              <span className="text-2xl font-black text-slate-900 leading-none">Instant CDN</span>
            </div>
          </div>

        </div>
      </div>

      {/* Main Grid: Filters & Library Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 mt-8">
        
        {/* Dynamic Controls Rack */}
        <div className="bg-white p-4.5 rounded-2.5xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row gap-4 items-center justify-between mb-8">
          
          {/* Quick Search */}
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-4 top-3.5 w-4.5 h-4.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search briefs, procedures, or uploaded crew..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 pl-11 pr-4 py-3 border border-slate-200 text-sm rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#DA291C]/25 text-slate-800 placeholder-slate-400 transition"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm("")}
                className="absolute right-4 top-3 text-slate-450 hover:text-slate-650"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Category Tab / Filters */}
          <div className="flex flex-wrap items-center gap-3.5 w-full lg:w-auto">
            
            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold text-slate-650">
              <SlidersHorizontal className="w-4 h-4 text-slate-400" />
              <span>Sort By:</span>
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="bg-transparent border-none focus:outline-none text-slate-900 font-extrabold cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="size">Largest File</option>
                <option value="uploader">Uploader Name</option>
              </select>
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold text-slate-650">
              <ArrowUpDown className="w-4 h-4 text-slate-400" />
              <span>Status:</span>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-transparent border-none focus:outline-none text-slate-900 font-extrabold cursor-pointer"
              >
                <option value="all">All statuses</option>
                <option value="ready">Ready (Active)</option>
                <option value="processing">Processing</option>
              </select>
            </div>

          </div>

        </div>

        {/* Video Grid layout split with specific Information Drawer */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Main List */}
          <div className={`lg:col-span-8 space-y-6 ${sortedVideos.length === 0 ? "" : ""}`}>
            
            {sortedVideos.length === 0 ? (
              <div className="bg-white p-14 rounded-3xl border border-dashed border-slate-250 text-center flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-slate-50 text-slate-350 border border-slate-200/60 rounded-full flex items-center justify-center mb-4">
                  <Film className="w-8 h-8" />
                </div>
                <h3 className="text-base font-extrabold text-slate-800 uppercase tracking-tight">No videos found</h3>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  We couldn't locate any storage objects matching "{searchTerm || "the active filters"}". Try writing something else or upload a new session clip!
                </p>
                <button
                  onClick={() => { setSearchTerm(""); setFilterCategory("all"); }}
                  className="mt-4 font-extrabold text-xs text-[#DA291C] hover:underline uppercase tracking-wide cursor-pointer"
                >
                  Clear Active Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {sortedVideos.map((video) => (
                  <motion.div
                    key={video.id}
                    layoutId={`video-${video.id}`}
                    className={`bg-white rounded-3xl border shadow-2xs overflow-hidden flex flex-col group relative transition-all duration-300 hover:shadow-md ${
                      selectedDetailsVideo?.id === video.id 
                        ? "ring-2 ring-red-500/70 border-red-300 bg-red-50/5" 
                        : "border-slate-200"
                    }`}
                  >
                    {/* Media Thumbnail with play triggers */}
                    <div className="aspect-video bg-slate-950 relative overflow-hidden shrink-0">
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        referrerPolicy="no-referrer"
                      />
                      
                      {/* Play Action Layer Overlay */}
                      <div 
                        className="absolute inset-0 bg-black/45 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer"
                        onClick={() => setActiveVideo(video)}
                      >
                        <div className="w-14 h-14 bg-[#DA291C] text-white rounded-full flex items-center justify-center shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 scale-90 group-hover:scale-100">
                          <Play className="w-6 h-6 fill-current ml-0.5" />
                        </div>
                      </div>

                      {/* Video status tag */}
                      {video.status === "processing" ? (
                        <div className="absolute top-3 left-3 bg-amber-500 text-white font-black text-[9px] uppercase tracking-wider px-2 py-1 rounded-md flex items-center gap-1 shadow-sm">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Processing</span>
                        </div>
                      ) : (
                        <div className="absolute top-3 left-3 bg-emerald-500/90 text-white font-black text-[9px] uppercase tracking-wider px-2 py-1 rounded-md flex items-center gap-1 shadow-sm">
                          <Check className="w-3 h-3 stroke-[3px]" />
                          <span>Ready</span>
                        </div>
                      )}

                      {/* Video timing badge */}
                      <span className="absolute bottom-3 right-3 bg-black/80 backdrop-blur-xs text-white text-[10px] font-bold font-mono px-2 py-0.5 rounded-md">
                        {video.duration || "0:00"}
                      </span>

                      {/* Total file size badge */}
                      <span className="absolute bottom-3 left-3 bg-black/40 backdrop-blur-2xs text-white text-[9px] opacity-75 font-bold font-mono px-1.5 py-0.5 rounded-md">
                        {formatBytes(video.fileSize)}
                      </span>
                    </div>

                    {/* Metadata Content area */}
                    <div className="p-5 flex-1 flex flex-col justify-between text-left relative">
                      
                      <div>
                        {/* Title click toggles details drawer */}
                        <div className="flex justify-between items-start gap-2 mb-1.5 align-middle">
                          <button
                            onClick={() => setSelectedDetailsVideo(video)}
                            className="font-black text-slate-850 hover:text-[#DA291C] transition-colors leading-snug tracking-tight text-[15px] outline-none text-left"
                          >
                            {video.title}
                          </button>
                        </div>

                        <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed mb-4 font-normal">
                          {video.description}
                        </p>
                      </div>

                      {/* Specs card footer */}
                      <div className="border-t border-slate-100 pt-3.5 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                        
                        <div className="flex items-center gap-1.5">
                          <div className="w-5.5 h-5.5 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-[9px] uppercase">
                            {video.uploadedBy?.slice(0, 2).toUpperCase() || "CR"}
                          </div>
                          <span className="text-slate-600 block truncate max-w-[110px]">{video.uploadedBy || "Crew Member"}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedDetailsVideo(video)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition"
                            title="Inspect video file details"
                          >
                            <Info className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setDeleteConfirmId(video.id)}
                            className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-[#DA291C] rounded-lg transition"
                            title="Delete file permanently"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                      </div>

                    </div>
                  </motion.div>
                ))}
              </div>
            )}

          </div>

          {/* Right Information panel details card (Responsive Sidebar) */}
          <div className="lg:col-span-4 lg:sticky lg:top-36">
            <AnimatePresence mode="wait">
              {selectedDetailsVideo ? (
                <motion.div
                  key={selectedDetailsVideo.id}
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm text-left relative"
                >
                  <button
                    onClick={() => setSelectedDetailsVideo(null)}
                    className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 font-bold transition"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-2.5 text-slate-450 uppercase tracking-wider font-extrabold text-[10px] mb-3">
                    <Info className="w-3.5 h-3.5 text-[#DA291C]" />
                    <span>Selected video parameters</span>
                  </div>

                  <div className="aspect-video bg-slate-100 rounded-2xl mb-4 overflow-hidden relative">
                    <img 
                      src={selectedDetailsVideo.thumbnailUrl} 
                      alt={selectedDetailsVideo.title} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <button
                        onClick={() => setActiveVideo(selectedDetailsVideo)}
                        className="w-11 h-11 bg-white hover:bg-slate-100 text-[#DA291C] rounded-full flex items-center justify-center shadow-lg"
                      >
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-extrabold text-slate-850 text-base leading-tight mb-2">
                    {selectedDetailsVideo.title}
                  </h3>

                  <div className="space-y-3.5 text-xs text-slate-600 mb-5">
                    
                    <div>
                      <span className="font-bold text-slate-400 block mb-0.5">Walkthrough Description</span>
                      <p className="text-slate-600 bg-slate-50 border border-slate-150 p-3 rounded-xl leading-relaxed text-[11px] font-medium max-h-36 overflow-y-auto no-scrollbar">
                        {selectedDetailsVideo.description}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <span className="font-bold text-slate-400 block">Uploaded By</span>
                        <span className="font-extrabold text-slate-800 truncate block">{selectedDetailsVideo.uploadedBy}</span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-400 block">Uploaded At</span>
                        <span className="font-extrabold text-slate-800 block">{formatDate(selectedDetailsVideo.uploadedAt)}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                      <div>
                        <span className="font-bold text-slate-400 block">Exact File Size</span>
                        <span className="font-extrabold text-slate-800 block">{formatBytes(selectedDetailsVideo.fileSize)}</span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-400 block">Clip Duration</span>
                        <span className="font-extrabold text-slate-850 block font-mono">{selectedDetailsVideo.duration || "0:00"}</span>
                      </div>
                    </div>

                    <div className="pt-2">
                      <span className="font-bold text-slate-400 block">Storage Path (Cloud Ref)</span>
                      <code className="text-[10px] text-slate-500 bg-slate-100 px-2 py-1 rounded block truncate font-mono mt-0.5" title={selectedDetailsVideo.storagePath}>
                        {selectedDetailsVideo.storagePath}
                      </code>
                    </div>

                  </div>

                  <div className="flex gap-2.5">
                    <button
                      onClick={() => setActiveVideo(selectedDetailsVideo)}
                      className="flex-1 bg-[#DA291C] hover:bg-[#B31910] text-white py-2.5 rounded-xl text-xs uppercase tracking-wider font-extrabold flex items-center justify-center gap-1.5 shadow-sm transition active:scale-97 cursor-pointer"
                    >
                      <PlayCircle className="w-4 h-4 fill-current" />
                      Stream Video
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(selectedDetailsVideo.id)}
                      className="bg-red-50 hover:bg-red-100 text-[#DA291C] p-2.5 rounded-xl border border-red-200 transition-all cursor-pointer"
                      title="Purge Object"
                    >
                      <Trash2 className="w-4.5 h-4.5 fill-current" />
                    </button>
                  </div>

                </motion.div>
              ) : (
                <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs text-center border-dashed">
                  <div className="w-12 h-12 bg-slate-50 border border-slate-200/50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <User className="w-5 h-5 text-slate-400" />
                  </div>
                  <h4 className="text-xs uppercase font-extrabold text-slate-800 tracking-tight">Walkthrough Inspector</h4>
                  <p className="text-[11px] text-slate-450 mt-1 max-w-[220px] mx-auto leading-normal">
                    Click on any video title to access detailed technical dimensions, path variables, and stream properties.
                  </p>
                </div>
              )}
            </AnimatePresence>
          </div>

        </div>

      </div>

      {/* RESSUMABLE UPLOAD MODAL */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
            >
              
              {/* Header */}
              <div className="p-6 bg-gradient-to-r from-red-50 to-amber-50 border-b border-rose-100 flex items-center justify-between">
                <div className="text-left">
                  <h3 className="text-lg font-black text-[#DA291C] uppercase tracking-tight flex items-center gap-2">
                    <Upload className="w-5 h-5 stroke-[2.5px]" />
                    Shift Walkthrough Uploader
                  </h3>
                  <p className="text-[10px] text-slate-500">Resumable high-definition chunks to Firebase Cloud</p>
                </div>
                
                <button 
                  onClick={() => setIsUploadModalOpen(false)}
                  disabled={uploadState === "generating_meta" || uploadState === "uploading"}
                  className="bg-slate-200/80 hover:bg-slate-300 text-slate-600 p-1.5 rounded-full transition disabled:opacity-40"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Content Scrollable */}
              <div className="p-6 overflow-y-auto space-y-5 text-left flex-1" onClick={(e) => e.stopPropagation()}>
                
                {uploadState === "idle" && (
                  <>
                    {/* Drag and drop Area */}
                    <div
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-4 border-dashed rounded-2xl p-8 text-center flex flex-col items-center justify-center cursor-pointer transition-all ${
                        dragActive 
                          ? "border-[#DA291C] bg-[#DA291C]/5 scale-99" 
                          : uploadFile 
                            ? "border-emerald-300 bg-emerald-50/5" 
                            : "border-slate-200 hover:border-slate-350 bg-slate-50/50"
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="video/mp4, video/quicktime, video/webm, video/x-msvideo, video/x-matroska"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) validateAndSetFile(file);
                        }}
                        className="hidden"
                      />

                      {uploadFile ? (
                        <>
                          <div className="w-12 h-12 bg-emerald-100 text-emerald-800 rounded-xl flex items-center justify-center mb-3">
                            <Check className="w-6 h-6 stroke-[3px]" />
                          </div>
                          <span className="text-xs font-black text-slate-800 block mb-1 truncate max-w-xs">{uploadFile.name}</span>
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 font-bold rounded-lg uppercase tracking-wide">
                            {formatBytes(uploadFile.size)} Loaded
                          </span>
                        </>
                      ) : (
                        <>
                          <div className="w-12 h-12 bg-amber-50 text-[#DA291C] rounded-xl flex items-center justify-center mb-3 shadow-2xs">
                            <Upload className="w-5 h-5 stroke-[2.5px]" />
                          </div>
                          <span className="text-xs font-black text-slate-800 block mb-1">Drag video clip here or browse</span>
                          <span className="text-[10px] text-slate-450 block max-w-sm leading-normal">
                            Supports MP4, MOV, WEBM, AVI, MKV (Max 500MB). Clips are automatically compressed on-the-fly.
                          </span>
                        </>
                      )}
                    </div>

                    {/* Inputs */}
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] uppercase font-black text-slate-400 tracking-wider block mb-1.5 text-left">Walkthrough Brief Title</label>
                        <input
                          type="text"
                          placeholder="e.g. Double Cheeseburger Meat Calibrations"
                          value={uploadTitle}
                          onChange={(e) => setUploadTitle(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:focus:ring-[#DA291C]/20"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-black text-slate-400 tracking-wider block mb-1.5 text-left">Training Brief Walkthrough Notes</label>
                        <textarea
                          placeholder="Provide deep descriptions on standard temperatures, timing, tools utilized, or sanitation guides..."
                          value={uploadDescription}
                          onChange={(e) => setUploadDescription(e.target.value)}
                          rows={3}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:focus:ring-[#DA291C]/20 text-slate-700"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Processing and Upload progress indicators */}
                {(uploadState === "generating_meta" || uploadState === "uploading" || uploadState === "success" || uploadState === "error") && (
                  <div className="py-8 text-center flex flex-col items-center justify-center space-y-5">
                    
                    {uploadState === "generating_meta" && (
                      <>
                        <Loader2 className="w-12 h-12 text-[#DA291C] animate-spin" />
                        <div>
                          <h4 className="text-sm font-black text-slate-800">Compiling Video Properties...</h4>
                          <p className="text-[11px] text-slate-450 max-w-xs mx-auto mt-1 leading-normal">
                            Analysing video frame sequences, extracting high-resolution thumbnails, and preparing secure Firebase structures.
                          </p>
                        </div>
                      </>
                    )}

                    {uploadState === "uploading" && (
                      <div className="w-full space-y-4 text-left px-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-xs uppercase font-black text-slate-400 tracking-widest block">Uploading Data Stream</h4>
                            <span className="text-base font-black text-slate-850 mt-1 block truncate max-w-xs">{uploadTitle}</span>
                          </div>
                          
                          <div className="text-right">
                            <span className="text-2xl font-black text-[#DA291C] block">{Math.round(uploadProgress)}%</span>
                            <span className="text-[10px] font-mono text-slate-400 font-bold block">{uploadSpeed} • ETA: {uploadEta}</span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden relative border border-slate-200">
                          <motion.div
                            className="bg-gradient-to-r from-[#DA291C] to-[#FFC72C] h-full rounded-full"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>

                        {/* Resumable Resume and Pause System Controls */}
                        <div className="flex gap-2 justify-center pt-3">
                          <button
                            onClick={handlePauseResume}
                            className={`px-4 py-2 rounded-xl text-xs uppercase font-bold tracking-wider cursor-pointer border ${
                              isPaused 
                                ? "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100" 
                                : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                            }`}
                          >
                            {isPaused ? "Resume Upload" : "Pause Upload"}
                          </button>
                          <button
                            onClick={handleCancelUpload}
                            className="px-4 py-2 bg-slate-100 border border-slate-200 text-slate-650 hover:bg-slate-200 rounded-xl text-xs uppercase font-bold tracking-wider cursor-pointer"
                          >
                            Cancel File
                          </button>
                        </div>
                      </div>
                    )}

                    {uploadState === "success" && (
                      <div className="space-y-3">
                        <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                          <Check className="w-8 h-8 stroke-[3px]" />
                        </div>
                        <h4 className="text-sm font-black text-slate-850">Video Uploaded Successfully!</h4>
                        <p className="text-[11px] text-slate-500 max-w-xs leading-normal">
                          Walkthrough uploaded and CDN registered. Updating operational grids...
                        </p>
                      </div>
                    )}

                    {uploadState === "error" && (
                      <div className="space-y-3 px-4">
                        <div className="w-14 h-14 bg-red-50 text-[#DA291C] rounded-full flex items-center justify-center mx-auto">
                          <AlertTriangle className="w-6 h-6 stroke-[2.5px]" />
                        </div>
                        <h4 className="text-sm font-black text-slate-850">Upload pipeline failed</h4>
                        <p className="text-[11px] text-[#DA291C] bg-red-50 border border-red-100 p-3 rounded-lg leading-relaxed max-w-sm mx-auto font-mono text-left">
                          {uploadErrorMsg}
                        </p>
                        <div className="flex gap-2.5 justify-center pt-2">
                          <button
                            onClick={startResumableUpload}
                            className="bg-[#DA291C] hover:bg-[#B31A12] text-white py-2 px-4 rounded-xl text-xs uppercase tracking-wider font-extrabold cursor-pointer"
                          >
                            Retry Upload
                          </button>
                          <button
                            onClick={handleCancelUpload}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-650 py-2 px-4 rounded-xl text-xs uppercase font-extrabold border cursor-pointer"
                          >
                            Choose Another File
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                )}

              </div>

              {/* Action Foooter for idle screen only */}
              {uploadState === "idle" && (
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-3 justify-end">
                  <button
                    onClick={() => { cleanupForm(); setIsUploadModalOpen(false); }}
                    className="px-5 py-2.5 hover:bg-slate-200 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-500 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={startResumableUpload}
                    disabled={!uploadFile || !uploadTitle}
                    className="bg-[#DA291C] hover:bg-[#B31910] text-white disabled:bg-slate-200 disabled:text-slate-400 font-extrabold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider transition shadow-sm cursor-pointer"
                  >
                    Sync onto live Cloud
                  </button>
                </div>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DETAILED DELETE CONFIRMATION SYSTEM MODAL */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl p-6 shadow-2xl w-full max-w-md text-left"
            >
              <div className="w-12 h-12 bg-red-50 text-[#DA291C] rounded-2xl flex items-center justify-center mb-4 border border-red-100">
                <Trash2 className="w-6 h-6 fill-current" />
              </div>

              <h3 className="text-lg font-black text-slate-850 tracking-tight leading-none mb-1">
                Purge clip permanently?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed mb-5">
                This will remove the media stream file from Google Firebase Storage and update the store procedures databases instantly. This action is irreversible.
              </p>

              <div className="flex gap-3 justify-end font-bold text-xs">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  disabled={!!deletingId}
                  className="px-4.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-650 rounded-xl uppercase tracking-wider transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const videoObj = videos.find((v) => v.id === deleteConfirmId);
                    if (videoObj) executeDelete(videoObj.id, videoObj.storagePath);
                  }}
                  disabled={!!deletingId}
                  className="px-4.5 py-2.5 bg-[#DA291C] hover:bg-red-800 text-white rounded-xl uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:bg-slate-300"
                >
                  {deletingId ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Purging...</span>
                    </>
                  ) : (
                    <span>Purge Stream</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* HTML5 TRAINING CUSTOM VIDEO PLAYER MODULE GATES */}
      {activeVideo && (
        <VideoPlayer
          videoUrl={activeVideo.videoUrl}
          title={activeVideo.title}
          onClose={() => setActiveVideo(null)}
        />
      )}

    </div>
  );
}
