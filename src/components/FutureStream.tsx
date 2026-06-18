/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { VideoMetadata, UserSession } from "../types";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, Settings, HardDrive, 
  Download, Trash2, Edit3, Heart, Eye, Share2, UploadCloud, FileVideo, 
  PlusCircle, CheckCircle2, AlertTriangle, ShieldCheck, RefreshCw, LayoutGrid, 
  SlidersHorizontal, Lock, Unlock, Search, User, Info, ExternalLink, 
  ArrowRight, Key, Gauge, ChevronRight, BarChart3, Star, Sparkles, Check, HelpCircle
} from "lucide-react";
import { storeVideoBlob, getVideoBlob, deleteVideoBlob } from "../utils/indexedDB";

interface FutureStreamProps {
  videos: VideoMetadata[];
  onSaveVideos: (videos: VideoMetadata[]) => void;
  currentSession: UserSession;
}

export default function FutureStream({ 
  videos = [], 
  onSaveVideos, 
  currentSession 
}: FutureStreamProps) {
  // Navigation tabs within FutureStream App
  type StreamTab = "dashboard" | "directory" | "upload" | "console";
  const [activeTab, setActiveTab] = useState<StreamTab>("dashboard");

  // Core Search & Filtering States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState<"date" | "size" | "name" | "popularity">("date");
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  // Custom Video Player & Playback State
  const [playingVideo, setPlayingVideo] = useState<VideoMetadata | null>(null);
  const [localPlayingUrl, setLocalPlayingUrl] = useState<string | null>(null);
  const [playerSpeed, setPlayerSpeed] = useState<number>(1.0);
  const [playerQuality, setPlayerQuality] = useState<string>("Auto (720p)");
  const [playerMuted, setPlayerMuted] = useState<boolean>(false);
  const [playerVolume, setPlayerVolume] = useState<number>(1.0);
  const [playerDuration, setPlayerDuration] = useState<number>(0);
  const [playerCurrentTime, setPlayerCurrentTime] = useState<number>(0);
  const [isPlayingState, setIsPlayingState] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);

  // Upload States (Single and Bulk Support)
  const [uploadProgressList, setUploadProgressList] = useState<{
    [key: string]: { name: string; progress: number; status: string; size: number }
  }>({});
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  
  // Custom video meta editing context
  const [videoTitle, setVideoTitle] = useState("");
  const [videoDesc, setVideoDesc] = useState("");
  const [videoCat, setVideoCat] = useState("Training Guides");
  const [videoCustomUrl, setVideoCustomUrl] = useState("");
  const [videoIsPrivate, setVideoIsPrivate] = useState(false);
  const [editingVideo, setEditingVideo] = useState<VideoMetadata | null>(null);

  // Authentication configuration manager states
  const [fsUser, setFsUser] = useState({
    username: currentSession?.username || "Commander",
    role: currentSession?.role || "Business Manager",
    email: currentSession?.username ? `${currentSession.username.toLowerCase()}@nebula-corp.com` : "crew@nebula-corp.com",
    isVerified: true
  });
  const [authEmailInput, setAuthEmailInput] = useState(fsUser.email);
  const [authRoleInput, setAuthRoleInput] = useState(fsUser.role);
  const [authPasswordVal, setAuthPasswordVal] = useState("");
  const [isResetSucceeded, setIsResetSucceeded] = useState(false);
  const [isProfileUpdated, setIsProfileUpdated] = useState(false);

  // Local storage cache inventory tracking
  const [indexedDbCachedIds, setIndexedDbCachedIds] = useState<Set<string>>(new Set());

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "info" | "warn" } | null>(null);

  const showToast = (text: string, type: "success" | "info" | "warn" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Scan IndexedDB files to look for cached binaries
  const refreshCacheInventory = async () => {
    const cached = new Set<string>();
    try {
      for (const vid of videos) {
        const stored = await getVideoBlob(vid.id);
        if (stored) {
          cached.add(vid.id);
        }
      }
      setIndexedDbCachedIds(cached);
    } catch (e) {
      console.warn("IndexedDB indexing failed:", e);
    }
  };

  useEffect(() => {
    refreshCacheInventory();
  }, [videos]);

  // Save volume state preference on reload
  useEffect(() => {
    const savedVol = localStorage.getItem("futurestream_vol");
    if (savedVol !== null) {
      setPlayerVolume(parseFloat(savedVol));
    }
  }, []);

  // Set selected video, handle extraction from IndexedDB or online URL
  const handlePlayVideo = async (vid: VideoMetadata) => {
    // Record visual analytics step (add simulation view counter)
    const updatedWithViews = videos.map(v => v.id === vid.id ? { ...v, views: (v.views || 0) + 1 } : v);
    onSaveVideos(updatedWithViews);

    setPlayingVideo(vid);
    setLocalPlayingUrl(null);
    setIsPlayingState(false);

    let streamUrl = vid.url || "";
    // If we have local IndexedDB file, generate dynamic object URL
    const localBlob = await getVideoBlob(vid.id);
    if (localBlob) {
      streamUrl = URL.createObjectURL(localBlob);
      setLocalPlayingUrl(streamUrl);
    }

    showToast(`Streaming "${vid.title}" via quantum tunnel...`, "info");

    // Check for previous saved playhead position to resume
    const savedPlayhead = localStorage.getItem(`fs_playhead_${vid.id}`);
    setTimeout(() => {
      if (videoRef.current) {
        if (savedPlayhead) {
          videoRef.current.currentTime = parseFloat(savedPlayhead);
          showToast(`Resumed playback at ${formatTime(parseFloat(savedPlayhead))}`, "success");
        }
        videoRef.current.play().then(() => {
          setIsPlayingState(true);
        }).catch(err => console.log("Auto-playback pending trigger:", err));
      }
    }, 500);
  };

  // Cleanup dynamic object urls
  useEffect(() => {
    return () => {
      if (localPlayingUrl) {
        URL.revokeObjectURL(localPlayingUrl);
      }
    };
  }, [localPlayingUrl]);

  // Track video current playhead status
  const handleTimeUpdate = () => {
    if (videoRef.current && playingVideo) {
      const curTime = videoRef.current.currentTime;
      setPlayerCurrentTime(curTime);
      // Save current playhead to resume position state
      localStorage.setItem(`fs_playhead_${playingVideo.id}`, curTime.toString());
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setPlayerDuration(videoRef.current.duration);
    }
  };

  // Controls operations
  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlayingState(true);
      } else {
        videoRef.current.pause();
        setIsPlayingState(false);
      }
    }
  };

  const handleSliderSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) {
      const targetTime = parseFloat(e.target.value);
      videoRef.current.currentTime = targetTime;
      setPlayerCurrentTime(targetTime);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const nextMuted = !playerMuted;
      videoRef.current.muted = nextMuted;
      setPlayerMuted(nextMuted);
    }
  };

  const handleVolumeSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setPlayerVolume(val);
    localStorage.setItem("futurestream_vol", val.toString());
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setPlayerMuted(val === 0);
    }
  };

  const changeSpeed = (speed: number) => {
    setPlayerSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    showToast(`Time dilation synchronized: ${speed}x playback speed`, "info");
  };

  const handleFullscreen = () => {
    if (playerContainerRef.current) {
      if (!document.fullscreenElement) {
        playerContainerRef.current.requestFullscreen().catch(err => {
          console.error("Full screen request rejected:", err);
        });
      } else {
        document.exitFullscreen();
      }
    }
  };

  // Video Drag and Drop upload functions
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

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const validFiles: File[] = [];
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        if (validateVideoFile(file)) {
          validFiles.push(file);
        }
      }
      if (validFiles.length > 0) {
        setBulkFiles(prev => [...prev, ...validFiles]);
        showToast(`${validFiles.length} file(s) staged into the plasma chamber queue!`, "info");
      }
    }
  };

  const handleManualFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const validFiles: File[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        if (validateVideoFile(file)) {
          validFiles.push(file);
        }
      }
      if (validFiles.length > 0) {
        setBulkFiles(prev => [...prev, ...validFiles]);
        showToast(`${validFiles.length} file(s) added successfully!`, "info");
      }
    }
  };

  const validateVideoFile = (file: File): boolean => {
    // 500 MB max size
    const MAX_SIZE_BYTES = 500 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      showToast(`Warning: "${file.name}" exceeds 500 MB maximum size limit allocation!`, "warn");
      return false;
    }
    const supportedExts = [".mp4", ".mov", ".avi", ".mkv", ".webm"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    const isSupported = supportedExts.includes(ext) || file.type.startsWith("video/");
    if (!isSupported) {
      showToast(`Unsupported format: "${file.name}". Please use MP4, MOV, AVI, MKV, or WEBM.`, "warn");
      return false;
    }
    return true;
  };

  // Auto geometric thumbnail generator
  const generateCyberThumbnail = (title: string): string => {
    // Generate a beautiful, high-tech glowing dark backdrop SVG base64
    const colors = ["#22d3ee", "#a78bfa", "#ec4899", "#3b82f6", "#10b981", "#f59e0b"];
    const idx = Math.abs(title.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)) % colors.length;
    const nextColor = colors[(idx + 1) % colors.length];
    const baseColor = colors[idx];

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 225" width="400" height="225">
        <defs>
          <radialGradient id="neonGlow" cx="50%" cy="50%" r="75%">
            <stop offset="0%" stop-color="${baseColor}" stop-opacity="0.35"/>
            <stop offset="85%" stop-color="#020617" stop-opacity="0.95"/>
          </radialGradient>
          <linearGradient id="cyberBorder" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#22d3ee"/>
            <stop offset="50%" stop-color="#a78bfa"/>
            <stop offset="100%" stop-color="#ec4899"/>
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="#090d16" />
        <rect width="100%" height="100%" fill="url(#neonGlow)" />
        <circle cx="200" cy="112" r="60" fill="none" stroke="url(#cyberBorder)" stroke-width="1" stroke-dasharray="8 4" opacity="0.4" />
        <polyline points="0,112 160,112 175,90 200,135 225,90 240,112 400,112" fill="none" stroke="${nextColor}" stroke-width="2" opacity="0.6"/>
        <text x="50%" y="45%" text-anchor="middle" fill="#f8fafc" font-family="system-ui, sans-serif" font-weight="900" font-size="16" letter-spacing="1">${title.substring(0, 24).toUpperCase()}${title.length > 24 ? "..." : ""}</text>
        <text x="50%" y="70%" text-anchor="middle" fill="${baseColor}" font-family="monospace" font-weight="extrabold" font-size="9" letter-spacing="3" opacity="0.85">NEBULA FUTURESTREAM SYSTEM</text>
        <rect x="10" y="10" width="380" height="205" fill="none" stroke="url(#cyberBorder)" stroke-width="1" rx="8" opacity="0.15" />
      </svg>
    `;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };

  // Perform IndexedDB binary write alongside firestore replication mock progress
  const uploadVideoFile = async (file: File) => {
    const tempId = "queued_" + Math.random().toString(36).substr(2, 9);
    setUploadProgressList(prev => ({
      ...prev,
      [tempId]: { name: file.name, progress: 5, status: "Warming reactor cores...", size: file.size }
    }));

    try {
      const realId = "vid_" + Date.now();
      
      // Step 1: Initial compression mapping/simulation
      await delay(600);
      setUploadProgressList(prev => ({
        ...prev,
        [tempId]: { ...prev[tempId], progress: 25, status: "Compressing telemetry payload..." }
      }));

      // Step 2: Write actual binary to local browser IndexedDB
      setUploadProgressList(prev => ({
        ...prev,
        [tempId]: { ...prev[tempId], progress: 50, status: "Caching binary within local browser matrix (IndexedDB)..." }
      }));
      await storeVideoBlob(realId, file).catch(e => console.log("Silent IndexedDB issue:", e));

      // Step 3: Fast CDN distribution simulate
      await delay(800);
      setUploadProgressList(prev => ({
        ...prev,
        [tempId]: { ...prev[tempId], progress: 80, status: "Streaming secure CDN replicates..." }
      }));

      // Step 4: Finalizing metadata model
      setUploadProgressList(prev => ({
        ...prev,
        [tempId]: { ...prev[tempId], progress: 95, status: "Registering global ledger index..." }
      }));
      await delay(500);

      // Save metadata to cloud state (replicates to Firestore via saveVideos prop)
      const cyberThumbnailB64 = generateCyberThumbnail(file.name.split(".")[0]);
      const newMeta: VideoMetadata = {
        id: realId,
        title: file.name.split(".")[0].replace(/[_-]/g, " "),
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || "video/mp4",
        uploadedBy: fsUser.username,
        uploadedRole: fsUser.role,
        timestamp: new Date().toISOString(),
        description: `Futuristic storage index compiled on ${new Date().toLocaleDateString()}. Sector-Z secure allocation frame locked. Ready for quantum streaming.`,
        category: "Training Guides",
        thumbnail: cyberThumbnailB64,
        isPrivate: false,
        likes: 0,
        likedBy: [],
        views: 1,
        downloads: 0
      };

      const updatedVideos = [newMeta, ...videos];
      onSaveVideos(updatedVideos);

      setUploadProgressList(prev => ({
        ...prev,
        [tempId]: { ...prev[tempId], progress: 100, status: "Quantum transport successful!" }
      }));

      showToast(`Video "${newMeta.title}" successfully launched and locked!`, "success");

      // Remote from process list after brief lag
      setTimeout(() => {
        setUploadProgressList(prev => {
          const cpy = { ...prev };
          delete cpy[tempId];
          return cpy;
        });
      }, 3000);

    } catch (err) {
      console.error("FutureStream Upload Matrix Malfunction:", err);
      setUploadProgressList(prev => ({
        ...prev,
        [tempId]: { ...prev[tempId], progress: 0, status: "MALFUNCTION: Reactor breach!" }
      }));
    }
  };

  // Multi file dispatcher
  const startBulkUploads = async () => {
    if (bulkFiles.length === 0) return;
    const queue = [...bulkFiles];
    setBulkFiles([]);
    setActiveTab("dashboard"); // Go back and view dashboard with real-time operations
    showToast(`Injecting ${queue.length} streams into quantum pipeline...`, "info");
    
    for (const f of queue) {
      await uploadVideoFile(f);
    }
  };

  const removeStagedFile = (idx: number) => {
    setBulkFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  // Edit Video Dialog Submission
  const handleStartEditing = (vid: VideoMetadata) => {
    setEditingVideo(vid);
    setVideoTitle(vid.title);
    setVideoDesc(vid.description || "");
    setVideoCat(vid.category || "Training Guides");
    setVideoCustomUrl(vid.url || "");
    setVideoIsPrivate(vid.isPrivate || false);
  };

  const submitEditedVideo = () => {
    if (!editingVideo) return;
    const revised = videos.map(v => {
      if (v.id === editingVideo.id) {
        return {
          ...v,
          title: videoTitle || v.title,
          description: videoDesc,
          category: videoCat,
          url: videoCustomUrl,
          isPrivate: videoIsPrivate,
          thumbnail: generateCyberThumbnail(videoTitle || v.title) // recreate glowing thumbnail SVG with updated label!
        };
      }
      return v;
    });

    onSaveVideos(revised);
    showToast("Global directory index compiled successfully!", "success");
    setEditingVideo(null);
  };

  // Download Video Blob
  const handleDownloadVideo = async (vid: VideoMetadata) => {
    try {
      const dbBlob = await getVideoBlob(vid.id);
      let dUrl = vid.url || "";
      let isLocal = false;

      if (dbBlob) {
        dUrl = URL.createObjectURL(dbBlob);
        isLocal = true;
      }

      if (!dUrl) {
        showToast("Error: Video binaries not cached on this network frame.", "warn");
        return;
      }

      // Record visual metrics
      const revised = videos.map(v => v.id === vid.id ? { ...v, downloads: (v.downloads || 0) + 1 } : v);
      onSaveVideos(revised);

      const anchor = document.createElement("a");
      anchor.href = dUrl;
      anchor.download = vid.fileName || `${vid.title}.mp4`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      if (isLocal) {
        setTimeout(() => URL.revokeObjectURL(dUrl), 5000);
      }

      showToast(`Downloading binary payload for: ${vid.title}`, "success");
    } catch (e) {
      console.error(e);
      showToast("Quantum replication stream broke during download.", "warn");
    }
  };

  // Toggle Favorite State
  const toggleFavorite = (vid: VideoMetadata) => {
    const isLiked = vid.likedBy?.includes(fsUser.username);
    let updatedLikes = vid.likes || 0;
    let nextLikedBy = vid.likedBy ? [...vid.likedBy] : [];

    if (isLiked) {
      updatedLikes = Math.max(0, updatedLikes - 1);
      nextLikedBy = nextLikedBy.filter(u => u !== fsUser.username);
      showToast("Removed from galactic favorites.", "info");
    } else {
      updatedLikes += 1;
      nextLikedBy.push(fsUser.username);
      showToast("Added to galactic favorites!", "success");
    }

    const revised = videos.map(v => v.id === vid.id ? { ...v, likes: updatedLikes, likedBy: nextLikedBy } : v);
    onSaveVideos(revised);
  };

  // Delete video permanently
  const handleDeleteVideo = async (id: string, name: string) => {
    if (confirm(`CRITICAL DESTRUCT TRIGGER: Erase "${name}" permanently from all systems?`)) {
      try {
        await deleteVideoBlob(id).catch(e => console.log("Local binary not present:", e));
        
        const revised = videos.filter(v => v.id !== id);
        onSaveVideos(revised);
        
        if (playingVideo?.id === id) {
          setPlayingVideo(null);
          setLocalPlayingUrl(null);
        }

        showToast("Element neutralized from directory", "warn");
      } catch (err) {
        showToast("Breach failed to completely delete local binary.", "warn");
      }
    }
  };

  // Copy share link copy with cyberpunk glow toast
  const handleCopyShareLink = (vid: VideoMetadata) => {
    const shareStr = `${window.location.origin}/share/video/${vid.id}?sec=nebula`;
    navigator.clipboard.writeText(shareStr);
    showToast(`Quantum beacon link copied to transceiver clipboard!`, "success");
  };

  // Handle Authentication Matrix Form Controls
  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setFsUser(prev => ({
      ...prev,
      email: authEmailInput,
      role: authRoleInput as any
    }));
    setIsProfileUpdated(true);
    showToast("Cosmic identity card updated!", "success");
    setTimeout(() => setIsProfileUpdated(false), 3000);
  };

  const handlePasswordReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!authPasswordVal.trim()) return;
    setIsResetSucceeded(true);
    setAuthPasswordVal("");
    showToast("Galactic credentials updated successfully!", "success");
    setTimeout(() => setIsResetSucceeded(false), 3500);
  };

  // Format Helper Utilities
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = 2;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  // Filter video collection based on UI filter preferences
  const finalFilteredVideos = videos.filter(vid => {
    // Search filter match
    const matchesSearch = 
      vid.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (vid.description && vid.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      vid.uploadedBy.toLowerCase().includes(searchQuery.toLowerCase());

    // Category filter match
    const matchesCat = selectedCategory === "All" || vid.category === selectedCategory;

    // Favorites match
    const matchesFav = !favoritesOnly || vid.likedBy?.includes(fsUser.username);

    // Private mode filters
    // If private matches, only owner can view, except if Business Manager
    const isOwner = vid.uploadedBy === fsUser.username;
    const isManager = fsUser.role === "Business Manager";
    const canView = !vid.isPrivate || isOwner || isManager;

    return matchesSearch && matchesCat && matchesFav && canView;
  }).sort((a, b) => {
    if (sortBy === "date") {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    } else if (sortBy === "size") {
      return b.fileSize - a.fileSize;
    } else if (sortBy === "name") {
      return a.title.localeCompare(b.title);
    } else if (sortBy === "popularity") {
      const aPop = (a.views || 0) + (a.likes || 0) * 4 + (a.downloads || 0) * 2;
      const bPop = (b.views || 0) + (b.likes || 0) * 4 + (b.downloads || 0) * 2;
      return bPop - aPop;
    }
    return 0;
  });

  // Calculate stats summary metrics
  const totalVideoCount = videos.length;
  const totalStorageUsedBytes = videos.reduce((acc, v) => acc + v.fileSize, 0);
  const totalDownloadsCount = videos.reduce((acc, v) => acc + (v.downloads || 0), 0);
  const totalViewsCount = videos.reduce((acc, v) => acc + (v.views || 0), 0);

  // Storage allocation is 10 GB (10 * 1024 * 1024 * 1024 bytes)
  const MAX_STORAGE_LEVEL = 10 * 1024 * 1024 * 1024;
  const storagePercentage = Math.min(100, parseFloat(((totalStorageUsedBytes / MAX_STORAGE_LEVEL) * 100).toFixed(2)));

  return (
    <div 
      className="bg-slate-950 text-slate-100 rounded-3xl p-4 sm:p-7 border border-violet-500/25 shadow-[0_0_50px_rgba(139,92,246,0.15)] flex flex-col gap-6 relative overflow-hidden" 
      id="future-stream-root"
    >
      {/* Absolute Neon Glow Particles */}
      <div className="absolute top-0 right-1/4 w-[120px] h-[120px] rounded-full bg-cyan-500/10 blur-[80px]" />
      <div className="absolute bottom-0 left-10 w-[200px] h-[200px] rounded-full bg-purple-500/10 blur-[120px]" />

      {/* Cyber Toast System */}
      {toastMessage && (
        <div 
          className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md transition-all duration-300 transform translate-y-0 animate-bounce
            ${toastMessage.type === "success" ? "bg-emerald-950/90 border-emerald-500/40 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.3)]" : ""}
            ${toastMessage.type === "info" ? "bg-slate-950/90 border-cyan-500/40 text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.3)]" : ""}
            ${toastMessage.type === "warn" ? "bg-rose-950/90 border-rose-500/40 text-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.3)]" : ""}
          `}
          id="futurestream-toast-notification"
        >
          {toastMessage.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
          {toastMessage.type === "info" && <Info className="w-5 h-5 text-cyan-400 shrink-0" />}
          {toastMessage.type === "warn" && <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />}
          <span className="text-[11px] font-mono tracking-tight font-extrabold">{toastMessage.text}</span>
        </div>
      )}

      {/* Top Header - Unified Title */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-5 border-b border-slate-900 pb-5" id="fs-workspace-header">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-tr from-cyan-500 to-violet-500 p-2.5 rounded-xl border border-cyan-400/30 animate-pulse relative">
              <Sparkles className="w-5 h-5 text-white" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-cyan-400 rounded-full animate-ping" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tighter uppercase fill-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-violet-400">
                  FutureStream
                </h1>
                <span className="bg-violet-950 border border-violet-500/30 text-violet-300 font-mono text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-widest">
                  Video Hub
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono tracking-wide uppercase">
                Stream, upload, and organize team training videos smoothly
              </p>
            </div>
          </div>
        </div>

        {/* Global FutureStream Tabs Navigation */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800 backdrop-blur-md self-start">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tight transition-all flex items-center gap-2 cursor-pointer
              ${activeTab === "dashboard" ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.35)]" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"}`}
          >
            <Gauge className="w-3.5 h-3.5" /> Dashboard
          </button>
          <button
            onClick={() => setActiveTab("directory")}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tight transition-all flex items-center gap-2 cursor-pointer
              ${activeTab === "directory" ? "bg-gradient-to-r from-blue-500 to-violet-600 text-white shadow-[0_0_15px_rgba(139,92,246,0.35)]" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"}`}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Video Gallery ({videos.length})
          </button>
          <button
            onClick={() => setActiveTab("upload")}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tight transition-all flex items-center gap-2 cursor-pointer
              ${activeTab === "upload" ? "bg-gradient-to-r from-violet-500 to-pink-600 text-white shadow-[0_0_15px_rgba(236,72,153,0.35)]" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"}`}
          >
            <UploadCloud className="w-3.5 h-3.5" /> Upload Video
          </button>
          <button
            onClick={() => setActiveTab("console")}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tight transition-all flex items-center gap-2 cursor-pointer
              ${activeTab === "console" ? "bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-[0_0_15px_rgba(244,63,94,0.35)]" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"}`}
          >
            <User className="w-3.5 h-3.5" /> My Settings
          </button>
        </div>
      </div>

      {/* Cybernetic Theater Active Player Display */}
      {playingVideo && (
        <div 
          className="bg-slate-950/80 border border-cyan-500/30 rounded-2xl p-3 sm:p-5 shadow-[0_0_35px_rgba(34,211,238,0.1)] space-y-4" 
          id="futurestream-immersive-theater-stage"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-cyan-400 rounded-full animate-ping shrink-0" />
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-tight text-cyan-400">
                Now Streaming: {playingVideo.title}
              </h3>
            </div>
            <button
              onClick={() => {
                setPlayingVideo(null);
                setLocalPlayingUrl(null);
              }}
              className="p-1 px-2.5 bg-slate-900 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 rounded-lg text-[10px] font-mono tracking-widest uppercase transition-all cursor-pointer"
            >
              Close Player
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Custom Interactive Player Stage */}
            <div className="lg:col-span-8 flex flex-col gap-2">
              <div 
                ref={playerContainerRef}
                className="relative aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 shadow-inner group flex items-center justify-center"
                id="custom-playback-viewport"
              >
                <video
                  ref={videoRef}
                  key={playingVideo.id}
                  src={localPlayingUrl || playingVideo.url}
                  className="w-full h-full object-contain"
                  playsInline
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onClick={togglePlay}
                >
                  <source src={localPlayingUrl || playingVideo.url} type={playingVideo.fileType || "video/mp4"} />
                  <source src={localPlayingUrl || playingVideo.url} type="video/webm" />
                  <source src={localPlayingUrl || playingVideo.url} type="video/quicktime" />
                </video>

                {/* Simulated Glass Control Panel Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-3 pointer-events-none z-10">
                  {/* Top Header details */}
                  <div className="flex items-center justify-between w-full">
                    <span className="bg-slate-900/90 text-[10px] font-mono font-bold px-2 py-1 rounded text-cyan-300 border border-cyan-500/20">
                      QUALITY: {playerQuality}
                    </span>
                    <span className="bg-slate-900/90 text-[10px] font-mono font-bold px-2 py-1 rounded text-violet-300 border border-violet-500/20">
                      SPEED: {playerSpeed}x
                    </span>
                  </div>

                  {/* Mid big giant play button */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                    className="self-center p-4 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-400/40 hover:scale-110 shadow-lg pointer-events-auto cursor-pointer transition-all active:scale-95 duration-200"
                  >
                    {isPlayingState ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 fill-current translate-x-0.5" />}
                  </button>

                  {/* Bottom glass control panel */}
                  <div className="space-y-2 pointer-events-auto w-full">
                    {/* Progress slider bar */}
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono text-cyan-300">{formatTime(playerCurrentTime)}</span>
                      <input
                        type="range"
                        min={0}
                        max={playerDuration || 100}
                        step={0.1}
                        value={playerCurrentTime}
                        onChange={handleSliderSeek}
                        className="flex-1 h-1.5 rounded bg-slate-800 accent-cyan-400 cursor-pointer border-0"
                      />
                      <span className="text-[10px] font-mono text-slate-400">{formatTime(playerDuration)}</span>
                    </div>

                    {/* Controls row */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={togglePlay}
                          className="p-1 px-1.5 bg-slate-900/90 hover:bg-slate-800 text-slate-100 rounded border border-slate-800 transition-all cursor-pointer"
                        >
                          {isPlayingState ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={toggleMute}
                            className="p-1 px-1.5 bg-slate-900/90 hover:bg-slate-800 text-slate-100 rounded border border-slate-800 transition-all cursor-pointer"
                          >
                            {playerMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5" />}
                          </button>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={playerVolume}
                            onChange={handleVolumeSlider}
                            className="w-16 h-1 rounded bg-slate-800 accent-cyan-400"
                          />
                        </div>
                      </div>

                      {/* Display / Native open option & fullscreen */}
                      <div className="flex items-center gap-2">
                        {/* Audio track simulator / speed */}
                        <div className="flex items-center gap-1.5 text-[9px] font-mono bg-slate-905 p-1 rounded-lg border border-slate-800">
                          {["1.0", "1.25", "1.5", "2.0"].map((spd) => (
                            <button
                              key={spd}
                              onClick={() => changeSpeed(parseFloat(spd))}
                              className={`px-1 rounded-sm cursor-pointer hover:bg-slate-800 transition-all ${playerSpeed === parseFloat(spd) ? "bg-cyan-500/20 text-cyan-300 font-extrabold border border-cyan-500/30" : "text-slate-400"}`}
                            >
                              {spd}x
                            </button>
                          ))}
                        </div>

                        {/* Simulated quality selector */}
                        <select
                          value={playerQuality}
                          onChange={(e) => {
                            setPlayerQuality(e.target.value);
                            showToast(`Quantum stream resolution updated to ${e.target.value}`, "info");
                          }}
                          className="bg-slate-900 text-slate-300 text-[9px] font-mono p-1 rounded border border-slate-800 cursor-pointer hidden sm:block outline-none"
                        >
                          <option>AHR (1080p Ultra)</option>
                          <option>Auto (720p)</option>
                          <option>SD Matrix (480p)</option>
                          <option>Cellular Grid (360p)</option>
                        </select>

                        <button
                          onClick={handleFullscreen}
                          className="p-1 px-1.5 bg-slate-900/90 hover:bg-slate-800 text-slate-100 rounded border border-slate-800 transition-all cursor-pointer"
                        >
                          <Maximize className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Touch Play HUD Indicator */}
                <div className="absolute right-3 top-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[9.5px] font-mono border border-slate-800 z-10 flex items-center gap-1">
                  <Heart className="w-3 h-3 text-cyan-400 animate-pulse fill-cyan-400/20" />
                  <span>Video Hub Active</span>
                </div>
              </div>

              {/* Mobile Rendering Fail-safe & Open Native Option */}
              <div className="flex items-center justify-between gap-2.5 p-3.5 bg-cyan-950/20 border border-cyan-500/20 rounded-xl">
                <div className="flex items-center gap-2 min-w-0">
                  <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                  <p className="text-[10px] text-slate-300 font-sans truncate pr-2">
                    IOS/Android hardware playback issues? Open the raw stream directly.
                  </p>
                </div>
                <a 
                  href={localPlayingUrl || playingVideo.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  onClick={() => {
                    const stats = videos.map(v => v.id === playingVideo.id ? { ...v, downloads: (v.downloads || 0) + 1 } : v);
                    onSaveVideos(stats);
                  }}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-lg text-[9px] font-extrabold uppercase tracking-widest text-center transition-all cursor-pointer shadow-sm flex items-center gap-1 shrink-0"
                >
                  Stream Natively <ExternalLink className="w-3 h-3 text-white" />
                </a>
              </div>
            </div>

            {/* Immersive Video Details Deck */}
            <div className="lg:col-span-4 bg-slate-900/50 rounded-xl p-4 sm:p-5 border border-slate-800/80 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 gap-2">
                  <span className="px-2.5 py-0.5 bg-violet-950 text-violet-300 border border-violet-500/20 rounded-full text-[9px] font-mono uppercase tracking-widest">
                    {playingVideo.category || "General SOP"}
                  </span>
                  <p className="text-[10px] text-slate-500 font-mono">
                    ID: {playingVideo.id}
                  </p>
                </div>

                <div className="space-y-1">
                  <h4 className="text-sm font-black uppercase text-slate-100 tracking-tight">
                    {playingVideo.title}
                  </h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-sans mt-1 bg-slate-950/30 p-2.5 rounded-lg border border-slate-800/40">
                    {playingVideo.description || "No supplemental details compiled for this sector file."}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-[10px] font-mono bg-slate-950/50 p-3 rounded-lg border border-slate-800/60 shadow-inner">
                  <div>
                    <span className="block text-slate-500 uppercase text-[8px]">Compiled Area</span>
                    <span className="text-slate-200 mt-0.5 block truncate">{playingVideo.fileName}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500 uppercase text-[8px]">Allocation Weight</span>
                    <span className="text-slate-200 mt-0.5 block">{formatBytes(playingVideo.fileSize)}</span>
                  </div>
                  <div className="mt-2">
                    <span className="block text-slate-500 uppercase text-[8px]">Transceiver Rank</span>
                    <span className="text-slate-200 mt-0.5 block truncate">{playingVideo.uploadedBy} ({playingVideo.uploadedRole})</span>
                  </div>
                  <div className="mt-2">
                    <span className="block text-slate-500 uppercase text-[8px]">Beacon Timestamp</span>
                    <span className="text-slate-200 mt-0.5 block">{new Date(playingVideo.timestamp).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Action grid deck */}
              <div className="grid grid-cols-2 gap-2 border-t border-slate-800 pt-4">
                <button
                  onClick={() => toggleFavorite(playingVideo)}
                  className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all outline-none cursor-pointer
                    ${playingVideo.likedBy?.includes(fsUser.username) 
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/35" 
                      : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"}`}
                >
                  <Heart className={`w-3.5 h-3.5 ${playingVideo.likedBy?.includes(fsUser.username) ? "fill-current text-rose-400" : ""}`} /> Favorite
                </button>
                <button
                  onClick={() => handleDownloadVideo(playingVideo)}
                  className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Download Video
                </button>
                <button
                  onClick={() => handleStartEditing(playingVideo)}
                  className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer col-span-2"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit Video Info
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Primary Workspace View Switchers */}
      {/* 1. FUTURISTIC OPERATIONAL DASHBOARD VIEW */}
      {activeTab === "dashboard" && (
        <div className="space-y-6" id="futurestream-bento-dashboard">
          {/* Main Stats Bento-Grid Deck */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Videos block */}
            <div className="bg-slate-900/60 rounded-2xl p-4 border border-cyan-500/25 relative overflow-hidden shadow-md group hover:border-cyan-400 transition-all duration-300">
              <div className="absolute top-0 right-0 w-[60px] h-[60px] bg-cyan-500/5 rounded-full blur-2xl" />
              <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5 mb-2.5">
                <span className="text-[10px] text-slate-400 font-mono font-bold tracking-wider uppercase">Active Streams</span>
                <FileVideo className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <p className="text-3xl font-black text-slate-100">{totalVideoCount}</p>
                <p className="text-[9px] text-slate-400 font-sans mt-1">Loaded on global ledger</p>
              </div>
            </div>

            {/* Storage Gauge block */}
            <div className="bg-slate-900/60 rounded-2xl p-4 border border-violet-500/25 relative overflow-hidden shadow-md group hover:border-violet-400 transition-all duration-300">
              <div className="absolute top-0 right-0 w-[60px] h-[60px] bg-violet-500/5 rounded-full blur-2xl" />
              <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5 mb-2.5">
                <span className="text-[10px] text-slate-400 font-mono font-bold tracking-wider uppercase">Vault Allocation</span>
                <HardDrive className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-100">{formatBytes(totalStorageUsedBytes)}</p>
                <div className="mt-2 text-[9px] text-slate-400 space-y-1">
                  <div className="w-full bg-slate-950 rounded-full h-1">
                    <div 
                      className="bg-gradient-to-r from-violet-500 to-pink-500 h-1 rounded-full shadow-[0_0_8px_rgba(139,92,246,0.6)]" 
                      style={{ width: `${storagePercentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between font-mono text-[8.5px] mt-1.5 text-slate-400">
                    <span>{storagePercentage}% full</span>
                    <span>10.00 GB CAP</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Total Streams View Count block */}
            <div className="bg-slate-900/60 rounded-2xl p-4 border border-pink-500/25 relative overflow-hidden shadow-md group hover:border-pink-400 transition-all duration-300">
              <div className="absolute top-0 right-0 w-[60px] h-[60px] bg-pink-500/5 rounded-full blur-2xl" />
              <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5 mb-2.5">
                <span className="text-[10px] text-slate-400 font-mono font-bold tracking-wider uppercase">Active Invocations</span>
                <Eye className="w-4 h-4 text-pink-400" />
              </div>
              <div>
                <p className="text-3xl font-black text-slate-100">{totalViewsCount}</p>
                <p className="text-[9px] text-slate-400 font-sans mt-1">Instant network plays</p>
              </div>
            </div>

            {/* Downloads block */}
            <div className="bg-slate-900/60 rounded-2xl p-4 border border-rose-500/25 relative overflow-hidden shadow-md group hover:border-rose-400 transition-all duration-300">
              <div className="absolute top-0 right-0 w-[60px] h-[60px] bg-rose-500/5 rounded-full blur-2xl" />
              <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5 mb-2.5">
                <span className="text-[10px] text-slate-400 font-mono font-bold tracking-wider uppercase">Downloads Block</span>
                <Download className="w-4 h-4 text-rose-400" />
              </div>
              <div>
                <p className="text-3xl font-black text-slate-100">{totalDownloadsCount}</p>
                <p className="text-[9px] text-slate-400 font-sans mt-1">Replications stored offline</p>
              </div>
            </div>
          </div>

          {/* Core Analytics SVG Line Charts and Recent uploads column */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5" id="fs-dashboard-analytics-grid">
            {/* Visual Vector Analytics Area Chart (glorious neon blue-to-violet glowing path) */}
            <div className="lg:col-span-8 bg-slate-900/40 rounded-2xl p-4 border border-slate-800/80 backdrop-blur-md flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-4 border-b border-slate-800/80 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4.5 h-4.5 text-cyan-400" />
                    <h4 className="text-xs font-black uppercase text-slate-200 tracking-wide">Stream Traffic &amp; Allocation Ledgers</h4>
                  </div>
                  <span className="text-[9px] font-mono bg-cyan-950/40 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded uppercase">
                    Live Telemetry
                  </span>
                </div>
                <p className="text-[10.5px] text-slate-400 max-w-xl font-sans leading-relaxed mb-4">
                  Dynamic analysis of quantum file interactions and upload velocity vectors matched across temporal sector grids.
                </p>
              </div>

              {/* Glowing High-Tech SVG Graph */}
              <div className="relative h-44 sm:h-52 w-full bg-slate-950/60 rounded-xl p-3 border border-slate-900 shadow-inner overflow-hidden mt-2">
                <div className="absolute top-3 left-4 flex gap-4 text-[9px] font-mono text-slate-500">
                  <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-cyan-400 rounded-full" /> Streams Traffic</div>
                  <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-violet-500 rounded-full" /> Space Velocity</div>
                </div>

                <svg viewBox="0 0 500 160" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="glow-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#c084fc" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="neon-line-grad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#22d3ee" />
                      <stop offset="50%" stopColor="#818cf8" />
                      <stop offset="100%" stopColor="#c084fc" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Guideline Grids */}
                  <line x1="0" y1="30" x2="500" y2="30" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="5 5" />
                  <line x1="0" y1="80" x2="500" y2="80" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="5 5" />
                  <line x1="0" y1="130" x2="500" y2="130" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="5 5" />

                  {/* Area fill path under traffic graph */}
                  <path 
                    d="M 0 135 C 50 110, 100 85, 150 115 C 200 145, 250 55, 300 70 C 350 85, 400 40, 450 50 C 475 55, 500 100, 500 160 L 0 160 Z" 
                    fill="url(#glow-grad)" 
                  />

                  {/* High Quality Bezier Smooth Curve Path */}
                  <path 
                    d="M 0 135 C 50 110, 100 85, 150 115 C 200 145, 250 55, 300 70 C 350 85, 400 40, 450 50 C 475 55, 500 100" 
                    fill="none" 
                    stroke="url(#neon-line-grad)" 
                    strokeWidth="2.5" 
                  />

                  {/* Secondary Dash velocity analysis line */}
                  <path 
                    d="M 0 150 L 80 130 L 160 140 L 240 100 L 320 120 L 400 80 L 500 65" 
                    fill="none" 
                    stroke="#a78bfa" 
                    strokeWidth="1" 
                    strokeDasharray="4 4" 
                    opacity="0.6" 
                  />

                  {/* Data Point circular glows */}
                  <circle cx="150" cy="115" r="4" fill="#06b6d4" stroke="#ffffff" strokeWidth="1" className="animate-pulse" />
                  <circle cx="300" cy="70" r="4" fill="#6366f1" stroke="#ffffff" strokeWidth="1" />
                  <circle cx="450" cy="50" r="4" fill="#d946ef" stroke="#ffffff" strokeWidth="1" />
                </svg>

                {/* Timeline indices */}
                <div className="absolute bottom-1 left-4 right-4 flex justify-between font-mono text-[8px] text-slate-500 uppercase">
                  <span>Sect-01</span>
                  <span>Sect-02</span>
                  <span>Sect-03</span>
                  <span>Sect-04</span>
                  <span>Sect-05</span>
                </div>
              </div>

              {/* Quick informational bottom banner card */}
              <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-950/50 p-3.5 rounded-xl border border-slate-900 mt-4 text-[10px] text-slate-400 font-sans">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>
                  <strong>AUTOMATED COMPRESSION PROTOCOLS:</strong> Advanced client-side IndexedDB caching handles parallel streams natively. Deletion clears physical sector storage block pointers safely.
                </span>
              </div>
            </div>

            {/* Live Upload Progress Monitor Queue and list of recent uploaded items */}
            <div className="lg:col-span-4 bg-slate-900/40 rounded-2xl p-4 border border-slate-800/80 backdrop-blur-md flex flex-col justify-between gap-4">
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
                  <RefreshCw className="w-4 h-4 text-violet-400 animate-spin" style={{ animationDuration: "8s" }} />
                  <h4 className="text-xs font-black uppercase text-slate-200 tracking-wide">Quantum Transmissions Queue</h4>
                </div>

                {/* Upload progresses */}
                {Object.keys(uploadProgressList).length > 0 ? (
                  <div className="space-y-3 max-h-[140px] overflow-y-auto pr-1">
                    {Object.entries(uploadProgressList).map(([id, item]: [string, any]) => (
                      <div key={id} className="bg-slate-950 p-2.5 rounded-xl border border-violet-500/20 text-[10px] font-mono space-y-1.5">
                        <div className="flex items-center justify-between text-slate-300 gap-2">
                          <span className="truncate pr-1 font-bold">{item.name}</span>
                          <span className="text-violet-400 font-extrabold">{item.progress}%</span>
                        </div>
                        <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                          <div className="bg-gradient-to-r from-cyan-400 to-violet-500 h-full transition-all duration-300" style={{ width: `${item.progress}%` }} />
                        </div>
                        <p className="text-[8.5px] text-slate-500 italic truncate">{item.status}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-7 bg-slate-950/40 rounded-xl border border-slate-900 shadow-inner">
                    <p className="text-[10px] text-slate-500 font-mono">NO ACTIVE NEURAL STREAM TRANSFERS</p>
                    <button 
                      onClick={() => setActiveTab("upload")}
                      className="mt-3.5 px-3 py-1.5 bg-slate-900 select-all hover:bg-slate-800 border border-slate-800 rounded-lg text-[9px] font-bold text-violet-300 uppercase tracking-widest cursor-pointer"
                    >
                      Stage Video In Transmitter
                    </button>
                  </div>
                )}

                {/* Recent uploads directory links */}
                <div className="space-y-2">
                  <h5 className="text-[9.5px] font-mono font-black text-slate-400 uppercase tracking-wider">Latest Decoded Sectors</h5>
                  {videos.slice(0, 3).length > 0 ? (
                    <div className="space-y-2">
                      {videos.slice(0, 3).map(vid => (
                        <div 
                          key={vid.id}
                          onClick={() => handlePlayVideo(vid)}
                          className="bg-slate-950 hover:bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60 hover:border-cyan-500/20 transition-all cursor-pointer flex items-center gap-2.5 group justify-between"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Visual glowing thumbnail placeholder */}
                            <div className="relative w-12 h-8 rounded-md bg-slate-900 border border-slate-800 overflow-hidden shrink-0">
                              <img src={vid.thumbnail || generateCyberThumbnail(vid.title)} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/10">
                                <Play className="w-2.5 h-2.5 text-white fill-current" />
                              </div>
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] font-extrabold text-slate-200 truncate group-hover:text-cyan-300 transition-all uppercase">{vid.title}</p>
                              <span className="text-[8px] text-slate-500 font-mono uppercase">{formatBytes(vid.fileSize)} • {vid.category}</span>
                            </div>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-cyan-400 transition-all shrink-0" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[9.5px] italic text-slate-500 text-center py-4 bg-slate-950/20 rounded">Ledger is empty.</p>
                  )}
                </div>
              </div>

              {/* View directory index fast redirection */}
              <button
                onClick={() => setActiveTab("directory")}
                className="w-full bg-slate-950 hover:bg-slate-900 text-slate-300 border border-slate-800 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all outline-none cursor-pointer"
              >
                Launch Fully Decoded Directory <ArrowRight className="w-3 h-3 text-cyan-400" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. LIVE VIDEO DIRECTORY LISTINGS WITH ADVANCED SEARCH/FILTERS */}
      {activeTab === "directory" && (
        <div className="space-y-5" id="fs-video-directory-listings">
          {/* Cyber Search HUD and Grid parameters */}
          <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 backdrop-blur-md flex flex-col md:flex-row gap-4 items-stretch justify-between" id="directory-hud-panel">
            {/* Search Input and glow outline */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search quantum stream directory..."
                className="w-full bg-slate-955 border border-slate-800 hover:border-violet-500/20 focus:border-cyan-400 text-slate-100 rounded-xl py-2.5 pl-10 pr-4 text-xs font-mono placeholder:text-slate-500 outline-none transition-all shadow-inner focus:shadow-[0_0_15px_rgba(34,211,238,0.1)]"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs uppercase font-mono"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Filtering options selectors row */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Filter favorites toggle */}
              <button
                onClick={() => setFavoritesOnly(prev => !prev)}
                className={`px-3 py-2.5 rounded-xl border text-[10px] font-mono uppercase font-black transition-all cursor-pointer flex items-center gap-1.5
                  ${favoritesOnly 
                    ? "bg-rose-950/60 border-rose-500/40 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.15)]" 
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300"}`}
              >
                <Star className={`w-3.5 h-3.5 ${favoritesOnly ? "fill-current text-rose-400" : ""}`} /> Favorites
              </button>

              {/* Sorting option list select */}
              <div className="flex items-center bg-slate-950 rounded-xl border border-slate-800 p-1">
                <span className="text-[8.5px] font-mono text-slate-500 uppercase px-2">Sort</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-transparent text-slate-300 text-[10px] font-mono py-1 px-1 pr-3 border-0 outline-none cursor-pointer font-bold"
                >
                  <option value="date">Newest First</option>
                  <option value="size">File Weight</option>
                  <option value="name">Alphanumeric</option>
                  <option value="popularity">Popularity</option>
                </select>
              </div>

              {/* Quick actions staging link */}
              <button
                onClick={() => setActiveTab("upload")}
                className="bg-gradient-to-r from-cyan-500 to-sky-600 hover:brightness-105 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95 border border-cyan-400/20"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Stage Stream
              </button>
            </div>
          </div>

          {/* Sub category horizontal capsules */}
          <div className="flex flex-wrap items-center gap-2" id="category-capsules-tabbar">
            {["All", "Training Guides", "SOP Procedures", "Safety & Hygiene", "Promotional"].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-[9.5px] font-mono uppercase font-bold tracking-wider transition-all cursor-pointer border
                  ${selectedCategory === cat 
                    ? "bg-violet-500/20 border-violet-400 text-violet-300 shadow-[0_0_8px_rgba(167,139,250,0.2)]" 
                    : "bg-slate-900 border-slate-800/80 text-slate-400 hover:text-slate-300"}`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Video Grid List Card Container */}
          {finalFilteredVideos.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" id="fs-video-grid-sector">
              {finalFilteredVideos.map((vid) => {
                const isCached = indexedDbCachedIds.has(vid.id);
                const isLiked = vid.likedBy?.includes(fsUser.username);
                const isActivePlay = playingVideo?.id === vid.id;

                return (
                  <div 
                    key={vid.id}
                    id={`fs-card-${vid.id}`}
                    className={`bg-slate-900/50 rounded-2xl border overflow-hidden flex flex-col justify-between group transition-all duration-300 shadow-sm
                      ${isActivePlay 
                        ? "border-cyan-500 shadow-[0_0_20px_rgba(34,211,238,0.15)] ring-1 ring-cyan-500/40 bg-slate-900/80" 
                        : "border-slate-800/80 hover:border-slate-700/80 hover:bg-slate-900/70"}`}
                  >
                    {/* Glowing Thumbnail Area */}
                    <div 
                      className="relative aspect-video bg-black/60 overflow-hidden cursor-pointer"
                      onClick={() => handlePlayVideo(vid)}
                    >
                      <img 
                        src={vid.thumbnail || generateCyberThumbnail(vid.title)} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                        alt={vid.title} 
                        referrerPolicy="no-referrer"
                      />

                      {/* Overlays card */}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />

                      {/* Video Category Capsule */}
                      <span className="absolute top-2.5 left-2.5 bg-slate-950/95 backdrop-blur-md px-2 py-0.5 rounded text-[8px] font-mono font-black text-violet-300 border border-violet-500/20 uppercase tracking-widest leading-none">
                        {vid.category || "Training Guide"}
                      </span>

                      {/* Harddrive Caching Badge Indicator */}
                      <span className={`absolute top-2.5 right-2.5 backdrop-blur-md px-2 py-0.5 rounded text-[8px] font-mono font-black border uppercase tracking-widest leading-none flex items-center gap-1
                        ${isCached 
                          ? "bg-emerald-950/95 text-emerald-400 border-emerald-500/30 shadow-[0_0_6px_rgba(16,185,129,0.2)]" 
                          : "bg-amber-950/95 text-amber-400 border-amber-500/30"}`}
                        title={isCached ? "Video binary is secured in local browser IndexedDB" : "Video binary is online via Cloud URL"}
                      >
                        <HardDrive className="w-2.5 h-2.5 shrink-0" />
                        {isCached ? "Chipped Local" : "Cloud Link"}
                      </span>

                      {/* Giant glowing hover play circle button */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="bg-cyan-500 text-white p-3.5 rounded-full shadow-lg border border-cyan-400/40 group-hover:scale-110 transition-transform duration-300">
                          <Play className="w-4 h-4 fill-current translate-x-0.5" />
                        </div>
                      </div>

                      {/* IsPrivate Locked indicators */}
                      {vid.isPrivate && (
                        <span className="absolute bottom-2 left-2.5 bg-rose-950/90 border border-rose-500/25 px-1.5 py-0.5 rounded text-[7.5px] font-mono uppercase text-rose-300 flex items-center gap-0.5 shadow-sm">
                          <Lock className="w-2.5 h-2.5" /> SECURE CONSOLE
                        </span>
                      )}

                      {/* Duration stamp display */}
                      <span className="absolute bottom-2 right-2.5 bg-black/85 px-1.5 py-0.5 rounded text-[8.5px] font-mono text-slate-300">
                        HD • {formatBytes(vid.fileSize)}
                      </span>
                    </div>

                    {/* Meta data card lower area */}
                    <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                      <div className="space-y-1">
                        <h4 
                          onClick={() => handlePlayVideo(vid)}
                          className="font-black text-xs sm:text-sm uppercase tracking-tight text-slate-100 group-hover:text-cyan-300 cursor-pointer line-clamp-1 transition-colors mt-0.5"
                        >
                          {vid.title}
                        </h4>
                        <p className="text-[10.5px] text-slate-400 line-clamp-2 leading-relaxed h-8 font-sans">
                          {vid.description || "No complementary files logged for this specific sector node."}
                        </p>
                      </div>

                      {/* Owner and visual metrics list values */}
                      <div className="flex items-center justify-between gap-2 text-[9px] font-mono text-slate-500 border-t border-slate-900 pt-2.5 mt-2">
                        <span className="truncate max-w-[120px]" title={`Uploaded by ${vid.uploadedBy}`}>
                          BY: {vid.uploadedBy}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="flex items-center gap-0.5" title="Downloads"><Download className="w-2.5 h-2.5" /> {vid.downloads || 0}</span>
                          <span className="flex items-center gap-0.5" title="Views"><Eye className="w-2.5 h-2.5" /> {vid.views || 0}</span>
                          <span className="flex items-center gap-0.5" title="Favorites"><Heart className="w-2.5 h-2.5" /> {vid.likes || 0}</span>
                        </div>
                      </div>

                      {/* Lower responsive operations button tray */}
                      <div className="grid grid-cols-4 gap-1 pt-2 border-t border-slate-900 mt-2">
                        <button
                          onClick={() => handlePlayVideo(vid)}
                          className="bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-200 py-1.5 rounded-lg text-[9.5px] font-bold uppercase transition-all cursor-pointer col-span-2 flex items-center justify-center gap-1 outline-none"
                        >
                          <Play className="w-2.5 h-2.5 fill-current" /> Stream
                        </button>
                        <button
                          onClick={() => toggleFavorite(vid)}
                          className="bg-slate-850 hover:bg-slate-800 text-slate-400 py-1.5 rounded-lg text-[9.5px] font-bold uppercase transition-all cursor-pointer flex items-center justify-center outline-none"
                        >
                          <Heart className={`w-3 h-3 ${isLiked ? "fill-current text-rose-400" : "text-slate-400"}`} />
                        </button>
                        <div className="relative group/opt">
                          <button
                            className="w-full bg-slate-850 hover:bg-slate-800 text-slate-400 py-1.5 rounded-lg text-[9.5px] font-bold uppercase transition-all cursor-pointer flex items-center justify-center outline-none"
                          >
                            •••
                          </button>
                          {/* Floating mini contextual menu card */}
                          <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover/opt:block z-45 w-[140px] bg-slate-950 border border-slate-800 shadow-xl rounded-xl p-1 font-mono text-[9px] uppercase">
                            <button
                              onClick={() => handleDownloadVideo(vid)}
                              className="w-full text-left p-2 hover:bg-slate-900 hover:text-cyan-300 text-slate-300 rounded-lg flex items-center gap-1 cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5 text-cyan-400" /> Download Blob
                            </button>
                            <button
                              onClick={() => handleCopyShareLink(vid)}
                              className="w-full text-left p-2 hover:bg-slate-900 hover:text-cyan-300 text-slate-300 rounded-lg flex items-center gap-1 cursor-pointer"
                            >
                              <Share2 className="w-3.5 h-3.5 text-cyan-400" /> Share Beacon
                            </button>
                            <button
                              onClick={() => handleStartEditing(vid)}
                              className="w-full text-left p-2 hover:bg-slate-900 hover:text-violet-300 text-slate-300 rounded-lg flex items-center gap-1 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-violet-400" /> Edit Metadata
                            </button>
                            <div className="border-t border-slate-900 my-1"/>
                            <button
                              onClick={() => handleDeleteVideo(vid.id, vid.title)}
                              className="w-full text-left p-2 hover:bg-rose-950/60 hover:text-rose-400 text-rose-500 rounded-lg flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-500" /> Destruct
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 bg-slate-900/30 rounded-3xl border border-slate-800/80" id="empty-directory-fallback">
              <PlusCircle className="w-12 h-12 text-slate-600 mx-auto mb-4 animate-bounce" />
              <p className="text-sm font-mono text-slate-300 uppercase tracking-wide">NO MATCHING SECTOR DEPLOYMENTS FOUND</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-2 font-sans">
                No telemetry streams found matching queries in active storage files. stage new feeds on the Transmitter!
              </p>
              <button 
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("All");
                  setFavoritesOnly(false);
                }}
                className="mt-5 px-4 py-2 bg-slate-900 border border-slate-800 hover:border-cyan-500/20 rounded-xl text-xs font-mono font-bold text-cyan-300 uppercase tracking-widest cursor-pointer"
              >
                Reset HUD Matrix
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. TRANSMITTER (SINGLE & BULK VIDEO UPLOAD INTERFACE) */}
      {activeTab === "upload" && (
        <div className="space-y-6" id="fs-transmitter-matrix">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Upload drop area and validator metrics */}
            <div className="lg:col-span-8 space-y-4">
              <div className="bg-slate-905 p-3.5 border border-slate-850 rounded-2xl flex items-center gap-2">
                <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
                  PAYLOAD LIMIT: 500 MB max weight per sector file. Supported nodes: MP4, MOV, AVI, MKV, WEBM
                </p>
              </div>

              {/* Advanced Drag Drop Chamber */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all duration-300 flex flex-col items-center justify-center gap-4 bg-slate-950/40 shadow-inner min-h-[300px]
                  ${dragActive 
                    ? "border-cyan-400 bg-cyan-950/20 shadow-[0_0_20px_rgba(34,211,238,0.15)]" 
                    : "border-slate-800 hover:border-violet-500/30 hover:bg-slate-900/10"}`}
                id="fs-drag-drop-viewport"
              >
                {/* Visual neon lines scanning effect */}
                {dragActive && (
                  <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent top-0 animate-[bounce_2s_infinite] shadow-[0_0_12px_rgba(34,211,238,0.8)]" />
                )}

                <div className="bg-gradient-to-tr from-slate-900 to-slate-950 p-5 rounded-2xl border border-slate-800 shadow-md">
                  <UploadCloud className="w-9 h-9 text-cyan-400 animate-pulse" />
                </div>

                <div className="space-y-1.5 max-w-sm">
                  <p className="text-xs sm:text-sm font-black text-slate-200 uppercase tracking-wide">
                    Drag and drop stream files or select manually
                  </p>
                  <p className="text-[10.5px] text-slate-500 font-sans leading-relaxed">
                    Local IndexedDB caching will compress and load files onto the browser ledger before syncing cloud indicators.
                  </p>
                </div>

                {/* Secret system input */}
                <input
                  type="file"
                  multiple
                  accept="video/*"
                  onChange={handleManualFileSelection}
                  className="hidden"
                  id="stage-video-manual-input"
                />
                <label
                  htmlFor="stage-video-manual-input"
                  className="px-5 py-2.5 bg-gradient-to-r from-violet-500 to-indigo-600 hover:brightness-110 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-md hover:shadow-violet-500/15 cursor-pointer transition-all active:scale-95 border border-violet-400/20"
                >
                  Locate Video Nodes
                </label>
              </div>

              {/* Bulk upload staged queue item displays */}
              {bulkFiles.length > 0 && (
                <div className="bg-slate-900/40 rounded-2xl p-4 border border-slate-800/80 space-y-3.5" id="bulk-staged-queue">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-1.5">
                      <SlidersHorizontal className="w-4 h-4 text-violet-400 animate-pulse" />
                      <h4 className="text-[11px] font-mono font-black text-slate-200 uppercase tracking-widest">
                        Staged Payload Queue ({bulkFiles.length} file{bulkFiles.length !== 1 ? "s" : ""})
                      </h4>
                    </div>
                    <button
                      onClick={() => setBulkFiles([])}
                      className="text-[9px] font-mono uppercase bg-slate-950 hover:bg-slate-900 hover:text-rose-400 text-slate-500 border border-slate-850 px-2 py-1 rounded cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {bulkFiles.map((file, index) => (
                      <div 
                        key={index}
                        className="bg-slate-950 p-2.5 rounded-xl border border-slate-900 hover:border-cyan-500/20 flex items-center justify-between gap-3 text-[10px] font-mono text-slate-300"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileVideo className="w-4 h-4 text-cyan-400 shrink-0" />
                          <div className="min-w-0">
                            <span className="font-extrabold truncate block pr-2 uppercase">{file.name}</span>
                            <span className="text-[8.5px] text-slate-500 block">{formatBytes(file.size)}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => removeStagedFile(index)}
                          className="p-1 hover:bg-slate-905 text-slate-500 hover:text-rose-400 rounded transition-all cursor-pointer"
                          title="Erase from staging"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Dispatcher controls section */}
                  <div className="pt-3 border-t border-slate-800 flex justify-end">
                    <button
                      onClick={startBulkUploads}
                      className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 text-slate-950 hover:text-white rounded-xl text-[10.5px] font-black uppercase tracking-widest shadow-md cursor-pointer transition-all active:scale-95"
                    >
                      Fire Plasma Transceiver Injection
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right instruction notes card */}
            <div className="lg:col-span-4 bg-slate-900/40 rounded-2xl p-5 border border-slate-800/80 backdrop-blur-md flex flex-col justify-between gap-5">
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-850 pb-3">
                  <ShieldCheck className="w-4 h-4 text-violet-400" />
                  <h4 className="text-xs font-black uppercase text-slate-200 tracking-wide">Secure Operations Manual</h4>
                </div>

                <div className="space-y-3 text-[10.5px] text-slate-400 font-sans leading-relaxed">
                  <div className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-950 font-mono text-[9px] font-black flex items-center justify-center border border-slate-800 text-cyan-400 shrink-0">1</span>
                    <p>Stage file payloads through either the local quantum drag chamber or manually locate the binaries.</p>
                  </div>
                  <div className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-950 font-mono text-[9px] font-black flex items-center justify-center border border-slate-800 text-cyan-400 shrink-0">2</span>
                    <p>Initial cache algorithms are processed entirely inside browser IndexedDB to support immediate offline playbacks.</p>
                  </div>
                  <div className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-950 font-mono text-[9px] font-black flex items-center justify-center border border-slate-800 text-cyan-400 shrink-0">3</span>
                    <p>The global storage map syncs with global peers. Other workstation nodes must pull files down via our peer network.</p>
                  </div>
                </div>
              </div>

              {/* Informative system statistics indicator */}
              <div className="bg-slate-950/80 border border-slate-850 p-4 rounded-xl font-mono text-[9px] text-slate-500 uppercase space-y-1">
                <p className="flex justify-between"><span>Active Node:</span> <span className="text-slate-300">workstation-sector-02</span></p>
                <p className="flex justify-between"><span>Transceiver Speed:</span> <span className="text-emerald-400">982 mb/s (sync)</span></p>
                <p className="flex justify-between"><span>Allocated Sectors:</span> <span className="text-slate-300">{indexedDbCachedIds.size} locally cached</span></p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. CONSOLING HOLOGRAPHIC AUTH PROFILE MATRIX */}
      {activeTab === "console" && (
        <div className="space-y-6" id="fs-authentication-matrix-panel">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Column - Profile and Credentials Form Cards */}
            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Profile Card Info Config */}
              <div className="bg-slate-900/40 p-5 rounded-3xl border border-slate-800/80 flex flex-col justify-between gap-5 relative overflow-hidden">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-850 pb-3">
                    <User className="w-4 h-4 text-cyan-400" />
                    <h4 className="text-xs font-black uppercase text-slate-200 tracking-wide">Cosmic Profile Node Matrix</h4>
                  </div>

                  <form onSubmit={handleUpdateProfile} className="space-y-3.5">
                    <div>
                      <label className="block text-[8.5px] font-mono text-slate-400 uppercase tracking-widest mb-1">Commander ID (Unique Name)</label>
                      <input 
                        type="text" 
                        disabled
                        value={fsUser.username} 
                        className="w-full bg-slate-950/60 border border-slate-850 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs font-mono text-slate-300 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[8.5px] font-mono text-slate-400 uppercase tracking-widest mb-1">Com transceiver (Email Address)</label>
                      <input 
                        type="email" 
                        value={authEmailInput} 
                        onChange={(e) => setAuthEmailInput(e.target.value)}
                        className="w-full bg-slate-950/60 border border-slate-850 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[8.5px] font-mono text-slate-400 uppercase tracking-widest mb-1">Workstation Role Privileges</label>
                      <select 
                        value={authRoleInput} 
                        onChange={(e) => setAuthRoleInput(e.target.value)}
                        className="w-full bg-slate-950/60 border border-slate-850 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 outline-none cursor-pointer"
                      >
                        <option value="Crew">Crew (Read-Only Matrix)</option>
                        <option value="Trainer">Trainer (Standard Operations)</option>
                        <option value="Kitchen Leader">Kitchen Leader</option>
                        <option value="Business Manager">Business Manager (Full Quantum Control)</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      className="w-full mt-2.5 py-2.5 bg-gradient-to-r from-cyan-500 to-sky-600 hover:brightness-110 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm transition-all cursor-pointer active:scale-95"
                    >
                      Update Identity Card
                    </button>
                  </form>
                </div>

                {isProfileUpdated && (
                  <div className="p-2.5 bg-emerald-950/80 border border-emerald-500/25 text-emerald-300 text-[10px] rounded-lg text-center font-mono animate-fade-in uppercase">
                    Profile matrices successfully updated.
                  </div>
                )}
              </div>

              {/* Password credentials reset card */}
              <div className="bg-slate-900/40 p-5 rounded-3xl border border-slate-800/80 flex flex-col justify-between gap-5 relative overflow-hidden">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-850 pb-3">
                    <Key className="w-4 h-4 text-violet-400" />
                    <h4 className="text-xs font-black uppercase text-slate-200 tracking-wide">Galactic Encryption Reset</h4>
                  </div>

                  <form onSubmit={handlePasswordReset} className="space-y-3.5">
                    <div>
                      <label className="block text-[8.5px] font-mono text-slate-400 uppercase tracking-widest mb-1">Old Sector Password</label>
                      <input 
                        type="password" 
                        placeholder="••••••••••••"
                        className="w-full bg-slate-950/60 border border-slate-850 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs font-mono text-slate-300 outline-none placeholder:text-slate-600"
                        disabled
                      />
                    </div>
                    <div>
                      <label className="block text-[8.5px] font-mono text-slate-400 uppercase tracking-widest mb-1">New Sector Code</label>
                      <input 
                        type="password" 
                        value={authPasswordVal}
                        onChange={(e) => setAuthPasswordVal(e.target.value)}
                        placeholder="Stage new encryption key..."
                        className="w-full bg-slate-950/60 border border-slate-850 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 outline-none pr-4"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full mt-2.5 py-2.5 bg-gradient-to-r from-violet-500 to-pink-600 hover:brightness-110 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm transition-all cursor-pointer active:scale-95"
                    >
                      Transmit Reset Signal
                    </button>
                  </form>
                </div>

                {isResetSucceeded && (
                  <div className="p-2.5 bg-violet-950/80 border border-violet-500/25 text-violet-300 text-[10px] rounded-lg text-center font-mono animate-fade-in uppercase">
                    Galactic credential hashes rewritten successfully!
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Matrix details and stats metadata visualization */}
            <div className="lg:col-span-4 bg-slate-900/40 rounded-2xl p-5 border border-slate-800/80 backdrop-blur-md space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-850 pb-3">
                <ShieldCheck className="w-4 h-4 text-rose-400" />
                <h4 className="text-xs font-black uppercase text-slate-200 tracking-wide">Security Clearing Matrix</h4>
              </div>

              <div className="space-y-4 text-[10.5px]">
                <div className="bg-slate-950/80 border border-slate-850 p-3.5 rounded-xl space-y-1.5 font-mono text-[9px] uppercase">
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Identity Status:</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" /> VERIFIED SIGNATURE
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Session Clearance:</span>
                    <span className="text-cyan-300">{fsUser.role}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Node IP Protocol:</span>
                    <span className="text-slate-300">10.234.34.12:9400</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Key Matrix Hash:</span>
                    <span className="text-slate-300 truncate max-w-[150px]">0xAA736FB8CDE921A3B</span>
                  </div>
                </div>

                {/* Secure instructions note */}
                <div className="text-slate-400 font-sans leading-relaxed space-y-2 text-[10px] p-2 bg-slate-950/30 rounded-lg">
                  <p><strong>Note:</strong> Role-based clearances are mapped in our Firestore matrix protocols internally.</p>
                  <p>Business Managers hold structural authorization to prune (delete) or alter (edit) sector directory entries globally. Trainers can upload and stream, while Crew hold pure Read-Only play indexes.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Nested Edit Metadata Overlay Dialog Portal */}
      {editingVideo && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6" id="edit-metadata-portal">
          <div className="bg-slate-950 border border-violet-500/30 rounded-3xl p-5 sm:p-6 max-w-md w-full space-y-4 shadow-2xl relative">
            <button
              onClick={() => setEditingVideo(null)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 cursor-pointer"
            >
              <Minimize className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
              <Edit3 className="w-4.5 h-4.5 text-cyan-400 animate-pulse" />
              <h3 className="text-xs sm:text-sm font-black uppercase text-slate-100 tracking-tight">Reconfigure Sector Entry</h3>
            </div>

            <div className="space-y-3.5 text-[10.5px]">
              <div>
                <label className="block text-[8.5px] font-mono text-slate-400 uppercase tracking-widest mb-1.5">Stream Label (Title)</label>
                <input
                  type="text"
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[8.5px] font-mono text-slate-400 uppercase tracking-widest mb-1.5">Sector Decryption Notes (Description)</label>
                <textarea
                  value={videoDesc}
                  onChange={(e) => setVideoDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs font-sans text-slate-200 outline-none resize-none leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[8.5px] font-mono text-slate-400 uppercase tracking-widest mb-1.5">Sector Category</label>
                  <select
                    value={videoCat}
                    onChange={(e) => setVideoCat(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs font-sans text-slate-300 outline-none cursor-pointer"
                  >
                    <option value="Training Guides">Training Guides</option>
                    <option value="SOP Procedures">SOP Procedures</option>
                    <option value="Safety & Hygiene">Safety & Hygiene</option>
                    <option value="Promotional">Promotional</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                  <div className="flex items-center gap-2.5 pb-2">
                    <input
                      type="checkbox"
                      checked={videoIsPrivate}
                      onChange={(e) => setVideoIsPrivate(e.target.checked)}
                      id="edit-is-private-checkbox"
                      className="w-4 h-4 rounded bg-slate-900 border-slate-800 text-cyan-400 accent-cyan-400 cursor-pointer"
                    />
                    <label htmlFor="edit-is-private-checkbox" className="text-[9px] font-mono font-bold uppercase text-slate-400 cursor-pointer">
                      Private Secure
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[8.5px] font-mono text-slate-400 uppercase tracking-widest mb-1.5">Custom Fallback Stream URL (Optional)</label>
                <input
                  type="text"
                  value={videoCustomUrl}
                  onChange={(e) => setVideoCustomUrl(e.target.value)}
                  placeholder="Insert secure external HTTPS storage path..."
                  className="w-full bg-slate-905 border border-slate-800 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs font-mono text-slate-400 outline-none placeholder:text-slate-700"
                />
              </div>
            </div>

            {/* Submit control panel */}
            <div className="pt-3 border-t border-slate-900 flex justify-end gap-2.5">
              <button
                onClick={() => setEditingVideo(null)}
                className="px-4 py-2 bg-slate-900 border border-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-[9px] font-mono tracking-widest uppercase cursor-pointer"
              >
                Abort
              </button>
              <button
                onClick={submitEditedVideo}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-105 text-white rounded-xl text-[9px] font-mono tracking-widest uppercase cursor-pointer"
              >
                Commit Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
