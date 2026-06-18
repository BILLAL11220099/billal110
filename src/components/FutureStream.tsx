/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import Hls from "hls.js";
import { VideoMetadata, UserSession } from "../types";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, Settings, HardDrive, 
  Download, Trash2, Edit3, Heart, Eye, Share2, UploadCloud, FileVideo, 
  PlusCircle, CheckCircle2, AlertTriangle, ShieldCheck, RefreshCw, LayoutGrid, 
  SlidersHorizontal, Lock, Unlock, Search, User, Info, ExternalLink, 
  ArrowRight, Key, Gauge, ChevronRight, BarChart3, Star, Sparkles, Check, HelpCircle
} from "lucide-react";

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
  const [activeTab, setActiveTab] = useState<StreamTab>("directory");

  // Server state list
  const [serverVideos, setServerVideos] = useState<VideoMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Core Search & Filtering States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState<"date" | "size" | "name" | "popularity">("date");
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  // Custom Video Player & Playback State
  const [playingVideo, setPlayingVideo] = useState<VideoMetadata | null>(null);
  const [playerSpeed, setPlayerSpeed] = useState<number>(1.0);
  const [playerQuality, setPlayerQuality] = useState<string>("Auto");
  const [hlsLevels, setHlsLevels] = useState<{ id: number; name: string }[]>([]);
  const [selectedLevelId, setSelectedLevelId] = useState<number>(-1); // -1 is Auto
  const [playerMuted, setPlayerMuted] = useState<boolean>(false);
  const [playerVolume, setPlayerVolume] = useState<number>(1.0);
  const [playerDuration, setPlayerDuration] = useState<number>(0);
  const [playerCurrentTime, setPlayerCurrentTime] = useState<number>(0);
  const [isPlayingState, setIsPlayingState] = useState<boolean>(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);

  // Upload States
  const [uploadProgressList, setUploadProgressList] = useState<{
    [key: string]: { name: string; progress: number; status: string; size: number }
  }>({});
  const [dragActive, setDragActive] = useState(false);
  
  // Custom video meta editing context
  const [videoTitle, setVideoTitle] = useState("");
  const [videoDesc, setVideoDesc] = useState("");
  const [videoCat, setVideoCat] = useState("Training Guides");
  const [videoIsPrivate, setVideoIsPrivate] = useState(false);
  const [editingVideo, setEditingVideo] = useState<VideoMetadata | null>(null);

  // User details
  const [fsUser, setFsUser] = useState({
    username: currentSession?.username || "Crew Member",
    role: currentSession?.role || "Crew",
    email: currentSession?.username ? `${currentSession.username.toLowerCase()}@nebula-corp.com` : "crew@nebula-corp.com",
    isVerified: true
  });

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "info" | "warn" } | null>(null);

  const showToast = (text: string, type: "success" | "info" | "warn" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Fetch videos authoritative list from full-stack server
  const fetchServerVideos = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await fetch("/api/videos");
      if (res.ok) {
        const data = await res.json();
        setServerVideos(data);
        // Sync with parent's Firebase callback
        if (onSaveVideos) {
          onSaveVideos(data);
        }
      }
    } catch (err) {
      console.error("Error fetching videos from server API:", err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchServerVideos();
  }, []);

  // 2. Poll server for transcoding progress if any video is 'Converting'
  useEffect(() => {
    const hasConvertingVideos = serverVideos.some(v => v.status === "Converting" || v.status === "Uploading");
    if (!hasConvertingVideos) return;

    const interval = setInterval(() => {
      fetchServerVideos(true);
    }, 3000);

    return () => clearInterval(interval);
  }, [serverVideos]);

  // Read volume state preference on reload
  useEffect(() => {
    const savedVol = localStorage.getItem("futurestream_vol");
    if (savedVol !== null) {
      const parsed = parseFloat(savedVol);
      setPlayerVolume(parsed);
      if (videoRef.current) {
        videoRef.current.volume = parsed;
      }
    }
  }, []);

  // 3. Initiate Hls.js or Native Playback
  useEffect(() => {
    if (!videoRef.current || !playingVideo) return;
    const video = videoRef.current;
    const streamUrl = playingVideo.url || "";

    // Reset HLS controller if active
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setHlsLevels([]);
    setSelectedLevelId(-1);
    setPlayerQuality("Auto");

    if (streamUrl.endsWith(".m3u8")) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          maxMaxBufferLength: 15,
          enableWorker: true,
          lowLatencyMode: true
        });
        hlsRef.current = hls;

        hls.loadSource(streamUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          // Extract quality levels
          const levels = hls.levels.map((lvl, index) => ({
            id: index,
            name: lvl.height ? `${lvl.height}p` : `Level ${index}`
          }));
          setHlsLevels(levels);

          if (isPlayingState) {
            video.play().catch(err => console.log("Auto-play blocked:", err));
          }
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
          const currentLvl = hls.levels[data.level];
          if (hls.autoLevelEnabled) {
            setPlayerQuality(`Auto (${currentLvl?.height ? currentLvl.height + "p" : "Adaptive"})`);
          } else {
            setPlayerQuality(currentLvl?.height ? `${currentLvl.height}p` : "Custom");
          }
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.warn("HLS Network Error, trying to recover...");
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.warn("HLS Media Error, trying to recover...");
                hls.recoverMediaError();
                break;
              default:
                console.error("Unrecoverable HLS error:", data);
                break;
            }
          }
        });

      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // iOS Safari Native HLS support
        video.src = streamUrl;
      }
    } else {
      // Direct progressive stream / fallback MP4
      video.src = streamUrl;
    }

    // Set Saved Duration or Position
    const savedPlayhead = localStorage.getItem(`fs_playhead_${playingVideo.id}`);
    const handleLoadedMetadataOnAttach = () => {
      if (savedPlayhead) {
        video.currentTime = parseFloat(savedPlayhead);
      }
      if (isPlayingState) {
        video.play().catch(() => {});
      }
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadataOnAttach);
    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadataOnAttach);
    };
  }, [playingVideo]);

  // Set Speed playback rate
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playerSpeed;
    }
  }, [playerSpeed, playingVideo]);

  // Handle Play/Pause
  const togglePlay = () => {
    if (!videoRef.current || !playingVideo) return;
    if (isPlayingState) {
      videoRef.current.pause();
      setIsPlayingState(false);
    } else {
      videoRef.current.play()
        .then(() => setIsPlayingState(true))
        .catch(err => {
          console.warn("Playback block action:", err);
          showToast("Click inside player bounds to activate sound", "info");
        });
    }
  };

  // Set video selection
  const handlePlayVideo = async (vid: VideoMetadata) => {
    if (vid.status === "Converting" || vid.status === "Uploading") {
      showToast("This video is being processed on the server. Plese wait.", "info");
      return;
    }

    // Ping analytics view increase on server
    fetch(`/api/videos/${vid.id}/views`, { method: "POST" });
    
    setPlayingVideo(vid);
    setIsPlayingState(true);
    showToast(`Streaming video: "${vid.title}"`, "success");
  };

  // Quality selector action
  const handleLevelChange = (levelId: number) => {
    setSelectedLevelId(levelId);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelId;
      if (levelId === -1) {
        setPlayerQuality("Auto");
      } else {
        const lvl = hlsRef.current.levels[levelId];
        setPlayerQuality(lvl?.height ? `${lvl.height}p` : "Selector Mode");
      }
    }
  };

  // Video metadata events
  const handleTimeUpdate = () => {
    if (videoRef.current && playingVideo) {
      setPlayerCurrentTime(videoRef.current.currentTime);
      localStorage.setItem(`fs_playhead_${playingVideo.id}`, videoRef.current.currentTime.toString());
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setPlayerDuration(videoRef.current.duration);
    }
  };

  // Handlers for sliders
  const handleSliderSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setPlayerCurrentTime(val);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
    }
  };

  const handleVolumeChange = (volValue: number) => {
    setPlayerVolume(volValue);
    localStorage.setItem("futurestream_vol", volValue.toString());
    if (videoRef.current) {
      videoRef.current.volume = volValue;
      videoRef.current.muted = volValue === 0;
    }
    setPlayerMuted(volValue === 0);
  };

  const toggleMute = () => {
    const val = !playerMuted;
    setPlayerMuted(val);
    if (videoRef.current) {
      videoRef.current.muted = val;
    }
  };

  // Large Video Multipart Upload
  const uploadVideoFile = async (file: File) => {
    const tempId = "upload_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    setUploadProgressList(prev => ({
      ...prev,
      [tempId]: { name: file.name, progress: 1, status: "Preparing server secure upload...", size: file.size }
    }));

    try {
      const formData = new FormData();
      formData.append("video", file);
      formData.append("id", "vid_" + Date.now());
      formData.append("title", file.name.split(".")[0].replace(/[_-]/g, " "));
      formData.append("uploadedBy", fsUser.username);
      formData.append("uploadedRole", fsUser.role);
      formData.append("category", videoCat);
      formData.append("description", `Universal learning module uploaded live on ${new Date().toLocaleDateString()}. Transcoded for multi-device cross compatibility.`);

      const xhr = new XMLHttpRequest();

      // Monitor progressive upload
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgressList(prev => ({
            ...prev,
            [tempId]: { 
              ...prev[tempId], 
              progress: percent, 
              status: percent === 100 ? "Processing and optimizing stream instantly..." : `Uploading: ${percent}%` 
            }
          }));
        }
      };

      // Handle server response
      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          showToast(`Video uploaded and processed successfully!`, "success");
          
          // Poll list immediately
          fetchServerVideos(true);

          // Update progress record to display active transcoding
          setUploadProgressList(prev => ({
            ...prev,
            [tempId]: { ...prev[tempId], progress: 100, status: "Optimized successfully! Video is online now." }
          }));

          // Clear upload card from list after 5 seconds
          setTimeout(() => {
            setUploadProgressList(prev => {
              const cpy = { ...prev };
              delete cpy[tempId];
              return cpy;
            });
          }, 5000);
        } else {
          throw new Error("Server rejected upload payload");
        }
      };

      xhr.onerror = () => {
        throw new Error("Network request failure");
      };

      xhr.open("POST", "/api/videos/upload");
      xhr.send(formData);

    } catch (err) {
      console.error("Upload process error:", err);
      showToast("Upload failed. Verify file size less than 500MB and connectivity.", "warn");
      setUploadProgressList(prev => ({
        ...prev,
        [tempId]: { ...prev[tempId], progress: 0, status: "Error uploading file." }
      }));
    }
  };

  // Video edit/save handler
  const handleSaveVideoEdits = async () => {
    if (!editingVideo) return;
    try {
      const res = await fetch(`/api/videos/${editingVideo.id}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: videoTitle,
          description: videoDesc,
          category: videoCat,
          isPrivate: videoIsPrivate
        })
      });

      if (res.ok) {
        showToast("Video settings updated successfully!", "success");
        setEditingVideo(null);
        fetchServerVideos();
      }
    } catch (err) {
      showToast("Error updating video registry.", "warn");
    }
  };

  // Remove video command
  const handleDeleteVideo = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}" permanently from the cloud?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/videos/${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast(`Video deleted from server directories.`, "success");
        if (playingVideo?.id === id) {
          setPlayingVideo(null);
        }
        fetchServerVideos();
      }
    } catch (err) {
      showToast("Could not communicate file deletion to server.", "warn");
    }
  };

  // Toggle Favorite list item
  const handleLikeVideo = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/videos/${id}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: fsUser.username })
      });
      if (res.ok) {
        fetchServerVideos(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Drag over areas
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
      const filesArray = Array.from(e.dataTransfer.files) as File[];
      const videoFiles = filesArray.filter(f => f.type.startsWith("video/"));
      if (videoFiles.length > 0) {
        videoFiles.forEach(file => uploadVideoFile(file));
        setActiveTab("upload");
      } else {
        showToast("Please supply standard video files (.mp4, .mov, etc.)", "warn");
      }
    }
  };

  const triggerManualFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      (Array.from(e.target.files) as File[]).forEach(file => uploadVideoFile(file));
      e.target.value = "";
    }
  };

  // Change individual speed
  const changeSpeed = (rate: number) => {
    setPlayerSpeed(rate);
  };

  // Filter & sort routine
  const getFilteredVideos = () => {
    return serverVideos
      .filter((vid) => {
        const matchesQuery =
          vid.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (vid.description || "").toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCat = selectedCategory === "All" || vid.category === selectedCategory;
        const matchesPriv = !vid.isPrivate || vid.uploadedBy === fsUser.username || fsUser.role === "Business Manager";
        const matchesFav = !favoritesOnly || (vid.likedBy || []).includes(fsUser.username);
        return matchesQuery && matchesCat && matchesPriv && matchesFav;
      })
      .sort((a, b) => {
        if (sortBy === "date") return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        if (sortBy === "size") return b.fileSize - a.fileSize;
        if (sortBy === "name") return a.title.localeCompare(b.title);
        if (sortBy === "popularity") return (b.views || 0) - (a.views || 0);
        return 0;
      });
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const dm = 1;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const filteredList = getFilteredVideos();

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 font-sans text-slate-100">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div 
          className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-xl flex items-center gap-3 animate-slide-in text-sm font-semibold max-w-sm border
            ${toastMessage.type === "success" ? "bg-emerald-950 border-emerald-500/30 text-emerald-300" :
              toastMessage.type === "warn" ? "bg-rose-950 border-rose-500/30 text-rose-300" :
              "bg-slate-900 border-slate-700/50 text-sky-300"}`}
        >
          <div className="w-2 h-2 rounded-full animate-ping bg-current" />
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5" id="fs-workspace-header">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-cyan-500 to-violet-600 rounded-lg">
              <FileVideo className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">
                  FutureStream Video Hub
                </h1>
                <span className="bg-violet-950/80 border border-violet-500/30 text-violet-300 font-mono text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider">
                  Universal Server Mode
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Transcodes every upload automatically to stream smoothly on Android, iPhone, iPad, Windows, and Mac.
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-900/90 border border-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("directory")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-tight transition-all flex items-center gap-1.5 cursor-pointer
              ${activeTab === "directory" ? "bg-cyan-500 text-white shadow-md" : "text-slate-400 hover:text-slate-200"}`}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Video Gallery ({serverVideos.length})
          </button>
          <button
            onClick={() => setActiveTab("upload")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-tight transition-all flex items-center gap-1.5 cursor-pointer
              ${activeTab === "upload" ? "bg-violet-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200"}`}
          >
            <UploadCloud className="w-3.5 h-3.5" /> Upload Video
          </button>
          <button
            onClick={() => setActiveTab("console")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-tight transition-all flex items-center gap-1.5 cursor-pointer
              ${activeTab === "console" ? "bg-slate-800 text-white shadow-md" : "text-slate-400 hover:text-slate-200"}`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" /> Transcode Status
          </button>
        </div>
      </div>

      {/* Main Streaming Active Stage (Expanded) */}
      {playingVideo && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden p-4 md:p-6 space-y-4 shadow-2xl animate-fade-in">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-cyan-400 rounded-full animate-ping shrink-0" />
              <h3 className="text-sm font-bold text-cyan-400">
                Now Streaming: {playingVideo.title}
              </h3>
            </div>
            <button
              onClick={() => {
                if (videoRef.current) videoRef.current.pause();
                setPlayingVideo(null);
                setIsPlayingState(false);
              }}
              className="px-3 py-1 bg-slate-900 border border-slate-700 hover:border-rose-500/40 text-slate-300 hover:text-rose-400 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            >
              Close Player
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Custom Interactive Player Stage */}
            <div className="lg:col-span-8 flex flex-col gap-3">
              <div 
                ref={playerContainerRef}
                className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-slate-850 shadow-inner group flex items-center justify-center"
              >
                <video
                  ref={videoRef}
                  key={playingVideo.id}
                  className="w-full h-full object-contain"
                  playsInline
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onClick={togglePlay}
                />

                {/* Overlay Player Controls (Responsive & Touch Gesture support) */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-4 pointer-events-none z-10">
                  <div className="flex items-center justify-between w-full">
                    <span className="bg-slate-950/90 text-[10px] font-mono font-bold px-2 py-1 rounded text-cyan-400 border border-cyan-500/20">
                      STREAM QUALITY: {playerQuality}
                    </span>
                    <span className="bg-slate-950/90 text-[10px] font-mono font-bold px-2 py-1 rounded text-violet-300 border border-violet-500/20">
                      SPEED: {playerSpeed}x
                    </span>
                  </div>

                  {/* Gigantic Play/Pause Indicator */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                    className="self-center p-4 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-400/30 hover:scale-110 shadow-lg pointer-events-auto cursor-pointer transition-all active:scale-95 duration-200"
                  >
                    {isPlayingState ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 fill-current translate-x-0.5" />}
                  </button>

                  {/* Timeline Scrubber */}
                  <div className="space-y-2 pointer-events-auto w-full">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono text-cyan-400">{formatTime(playerCurrentTime)}</span>
                      <input
                        type="range"
                        min={0}
                        max={playerDuration || 100}
                        step={0.1}
                        value={playerCurrentTime}
                        onChange={handleSliderSeek}
                        className="flex-1 h-1 bg-slate-800 accent-cyan-400 cursor-pointer rounded-lg appearance-none"
                      />
                      <span className="text-[10px] font-mono text-slate-400">{formatTime(playerDuration)}</span>
                    </div>

                    {/* Bottom Utility Bar */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={togglePlay}
                          className="p-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-100 rounded-lg cursor-pointer transition-all"
                        >
                          {isPlayingState ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={toggleMute}
                            className="p-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-100 rounded-lg cursor-pointer transition-all"
                          >
                            {playerMuted ? <VolumeX className="w-4 h-4 text-rose-400 animate-pulse" /> : <Volume2 className="w-4 h-4" />}
                          </button>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={playerVolume}
                            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                            className="w-16 h-1 bg-slate-800 accent-cyan-400 cursor-pointer"
                          />
                        </div>
                      </div>

                      {/* Speed & HLS Resolution Levels */}
                      <div className="flex items-center gap-2">
                        {/* Speed Controller */}
                        <div className="flex items-center gap-1 text-[9px] font-mono bg-slate-900 p-1 rounded-lg border border-slate-800">
                          {[1.0, 1.25, 1.5, 2.0].map((rate) => (
                            <button
                              key={rate}
                              onClick={() => changeSpeed(rate)}
                              className={`px-1 rounded cursor-pointer transition-all ${playerSpeed === rate ? "bg-cyan-500/20 text-cyan-300 font-bold" : "text-slate-400 hover:text-slate-200"}`}
                            >
                              {rate}x
                            </button>
                          ))}
                        </div>

                        {/* HLS Resolution Level Switcher */}
                        {hlsLevels.length > 0 && (
                          <div className="flex items-center gap-1 text-[9px] font-mono bg-slate-900 p-1 rounded-lg border border-slate-800">
                            <button
                              onClick={() => handleLevelChange(-1)}
                              className={`px-1.5 py-0.5 rounded cursor-pointer transition-all ${selectedLevelId === -1 ? "bg-violet-600/30 text-violet-300 font-bold border border-violet-500/30" : "text-slate-400 hover:text-slate-200"}`}
                            >
                              AUTO
                            </button>
                            {hlsLevels.map((lvl) => (
                              <button
                                key={lvl.id}
                                onClick={() => handleLevelChange(lvl.id)}
                                className={`px-1.5 py-0.5 rounded cursor-pointer transition-all ${selectedLevelId === lvl.id ? "bg-cyan-500/30 text-cyan-300 font-bold border border-cyan-500/30" : "text-slate-400 hover:text-slate-200"}`}
                              >
                                {lvl.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Direct Desktop Seek Guide */}
              <p className="text-[10px] text-slate-500 font-mono text-center">
                Interactive mobile support. Drag seeking scrubber or press big overlay circle to activate fluidly.
              </p>
            </div>

            {/* Panel Metadata Details */}
            <div className="lg:col-span-4 flex flex-col justify-between bg-slate-900/60 border border-slate-850 p-4 rounded-xl space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider bg-slate-850 px-2.5 py-1 rounded">
                    {playingVideo.category || "General Info"}
                  </span>
                  <span className="text-[9px] font-mono text-slate-500">
                    ID: {playingVideo.id}
                  </span>
                </div>

                <h4 className="text-base font-extrabold text-white leading-snug">
                  {playingVideo.title}
                </h4>

                <p className="text-xs text-slate-400 leading-relaxed max-h-[140px] overflow-y-auto pr-1">
                  {playingVideo.description || "Secure learning module indexed inside server system frame. Processed for global mobile streaming."}
                </p>

                <div className="space-y-1.5 font-mono text-[10px] text-slate-500 bg-slate-950/80 p-3 rounded-lg border border-slate-800">
                  <p className="flex justify-between"><span>Uploaded By:</span> <span className="text-slate-300 font-bold">{playingVideo.uploadedBy} ({playingVideo.uploadedRole})</span></p>
                  <p className="flex justify-between"><span>File Scale:</span> <span className="text-slate-300">{formatSize(playingVideo.fileSize)}</span></p>
                  <p className="flex justify-between"><span>Type:</span> <span className="text-emerald-400 font-bold">{playingVideo.fileType}</span></p>
                  <p className="flex justify-between"><span>Uploaded On:</span> <span className="text-slate-300">{new Date(playingVideo.timestamp).toLocaleDateString()}</span></p>
                  <p className="flex justify-between"><span>Views:</span> <span className="text-cyan-400 font-extrabold">{playingVideo.views || 0}</span></p>
                </div>
              </div>

              {/* Secure Download Links & Direct Replication */}
              <div className="space-y-2 border-t border-slate-800 pt-3">
                <a
                  href={`/uploads/${playingVideo.id}/source${playingVideo.fileName ? '.' + playingVideo.fileName.split('.').pop() : '.mp4'}`}
                  download={playingVideo.fileName || `${playingVideo.title}.mp4`}
                  className="w-full bg-slate-800 hover:bg-slate-750 text-slate-200 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all text-center"
                >
                  <Download className="w-4 h-4" /> Secure Download Video
                </a>
                <button
                  onClick={() => {
                    setVideoTitle(playingVideo.title);
                    setVideoDesc(playingVideo.description || "");
                    setVideoCat(playingVideo.category || "Training Guides");
                    setVideoIsPrivate(playingVideo.isPrivate || false);
                    setEditingVideo(playingVideo);
                  }}
                  className="w-full bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" /> Edit Video Info
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs Layout blocks */}
      {activeTab === "directory" && (
        <div className="space-y-4">
          
          {/* Filtering Header utilities panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Search Input bar */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search videos, guides, index metrics..."
                className="w-full bg-slate-950 border border-slate-800 pl-10 pr-4 py-2 text-xs rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")} 
                  className="absolute right-3 top-2 text-slate-500 hover:text-slate-300 text-xs"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Quick selectors dropdown */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-3 py-1.5 text-slate-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="All">All Categories</option>
                <option value="Training Guides">Training Guides</option>
                <option value="Kitchen Operations">Kitchen Operations</option>
                <option value="Food Safety Guides">Food Safety Guides</option>
                <option value="Point Of Sale POS">Point Of Sale POS</option>
                <option value="Manager Handbooks">Manager Handbooks</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-3 py-1.5 text-slate-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="date">Sort By: Date</option>
                <option value="popularity">Sort By: Views</option>
                <option value="size">Sort By: File Size</option>
                <option value="name">Sort By: Name</option>
              </select>

              <button
                onClick={() => setFavoritesOnly(!favoritesOnly)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1 cursor-pointer transition-all
                  ${favoritesOnly ? "bg-amber-500/20 text-amber-300 border-amber-500/40" : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300"}`}
              >
                <Star className={`w-3.5 h-3.5 ${favoritesOnly ? "fill-amber-300 text-amber-300" : ""}`} /> Favorites
              </button>
            </div>
          </div>

          {/* Active directory list grids */}
          {isLoading ? (
            <div className="py-24 text-center space-y-4 bg-slate-900/40 rounded-2xl border border-slate-800">
              <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
              <p className="text-xs font-mono text-slate-400">Loading videos from server database...</p>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="py-20 text-center space-y-3 bg-slate-900/40 rounded-2xl border border-slate-800" onDragOver={handleDrag} onDragEnter={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop}>
              <div className="w-12 h-12 bg-slate-850 border border-slate-800 text-slate-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <FileVideo className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-300">No Video Files Listed</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No matching videos are available in the registry. Select another search term or click below to upload a training guide.
              </p>
              <button
                onClick={() => setActiveTab("upload")}
                className="bg-gradient-to-r from-cyan-500 to-violet-600 hover:scale-105 active:scale-95 text-white shadow-md text-xs font-bold py-2 px-4 rounded-xl uppercase tracking-wider transition-all cursor-pointer inline-flex items-center gap-1.5 mt-2"
              >
                <PlusCircle className="w-4 h-4" /> Upload Video
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredList.map((vid) => {
                const isItemConverting = vid.status === "Converting" || vid.status === "Uploading";
                const isFav = (vid.likedBy || []).includes(fsUser.username);
                return (
                  <div 
                    key={vid.id}
                    id={`video-card-${vid.id}`}
                    onClick={() => handlePlayVideo(vid)}
                    className={`bg-slate-900/80 border rounded-2xl overflow-hidden group shadow-md transition-all duration-300 hover:shadow-cyan-500/10 cursor-pointer
                      ${playingVideo?.id === vid.id ? "border-cyan-500 bg-slate-900" : "border-slate-800 bg-slate-900/40 hover:border-slate-700"}`}
                  >
                    {/* Visual Card Image Cover */}
                    <div className="relative aspect-video bg-black overflow-hidden select-none">
                      <img 
                        src={vid.thumbnail} 
                        referrerPolicy="no-referrer"
                        alt={vid.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      
                      {/* Play Hover Indicator */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-10">
                        {isItemConverting ? (
                          <div className="p-3 bg-violet-600 text-white rounded-full flex items-center justify-center">
                            <RefreshCw className="w-5 h-5 animate-spin" />
                          </div>
                        ) : (
                          <div className="p-3 bg-cyan-500 text-white rounded-full shadow-lg flex items-center justify-center transform scale-90 group-hover:scale-100 transition-transform">
                            <Play className="w-5 h-5 fill-current translate-x-0.5" />
                          </div>
                        )}
                      </div>

                      {/* Video Category Capsule */}
                      <span className="absolute top-3 left-3 bg-slate-950/80 border border-slate-800 text-slate-300 text-[9px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider z-10">
                        {vid.category || "General"}
                      </span>

                      {/* Video Duration / Stat Labels */}
                      {isItemConverting ? (
                        <span className="absolute bottom-3 right-3 bg-violet-950 border border-violet-500/30 text-violet-300 text-[9px] font-mono font-extrabold px-2 py-0.5 rounded uppercase tracking-widest animate-pulse z-10 flex items-center gap-1">
                          <RefreshCw className="w-2.5 h-2.5 animate-spin text-purple-400" /> Transcoding...
                        </span>
                      ) : (
                        <span className="absolute bottom-3 right-3 bg-slate-950/85 border border-slate-800 text-slate-200 text-[9px] font-mono px-1.5 py-0.5 rounded tracking-wide z-10">
                          {formatSize(vid.fileSize)}
                        </span>
                      )}

                      {/* Favorite Button */}
                      <button
                        onClick={(e) => handleLikeVideo(vid.id, e)}
                        className={`absolute top-3 right-3 p-1.5 rounded-lg border backdrop-blur-md transition-all shadow-md z-10 cursor-pointer
                          ${isFav 
                            ? "bg-amber-500 text-white border-amber-400" 
                            : "bg-slate-950/70 border-slate-800 text-slate-400 hover:text-white"}`}
                      >
                        <Star className={`w-3.5 h-3.5 ${isFav ? "fill-current" : ""}`} />
                      </button>
                    </div>

                    {/* Card Content parameters */}
                    <div className="p-4 space-y-2.5">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-xs font-bold text-white group-hover:text-cyan-400 font-sans tracking-tight truncate flex-1">
                            {vid.title}
                          </h4>
                          {vid.isPrivate && (
                            <Lock className="w-3 h-3 text-rose-400 shrink-0" />
                          )}
                        </div>
                        <p className="text-[10.5px] text-slate-400 line-clamp-2 leading-relaxed">
                          {vid.description || "Digital system video documentation files secure-locked on team nodes."}
                        </p>
                      </div>

                      {/* Card Details stats footer */}
                      <div className="flex items-center justify-between border-t border-slate-800/80 pt-2.5 font-mono text-[9px] text-slate-500">
                        <span className="truncate pr-1 max-w-[150px]">
                          By {vid.uploadedBy}
                        </span>
                        <div className="flex items-center gap-2 text-slate-400 font-bold">
                          <span className="flex items-center gap-0.5">
                            <Eye className="w-3 h-3 text-cyan-500" /> {vid.views || 0}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Heart className="w-3 h-3 text-rose-500" /> {vid.likes || 0}
                          </span>
                        </div>
                      </div>

                      {/* Action Triggers Grid */}
                      <div className="flex items-center gap-1.5 border-t border-slate-800 pt-2 text-[10px]">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlayVideo(vid);
                          }}
                          className="flex-1 py-1 rounded text-center bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-800 transition-all font-semibold"
                        >
                          Watch Video
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteVideo(vid.id, vid.title);
                          }}
                          className="p-1 px-2 rounded bg-slate-900 border border-slate-800 hover:border-rose-500/20 text-slate-500 hover:text-rose-400 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick drag zone backup indicator */}
          <div 
            onDragOver={handleDrag}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`py-8 text-center border rounded-xl transition-all font-mono text-[10px] uppercase tracking-widest leading-none flex items-center justify-center gap-2
              ${dragActive 
                ? "bg-cyan-500/10 border-cyan-400 text-cyan-300" 
                : "bg-slate-950/20 border-slate-850 text-slate-500 border-dashed"}`}
          >
            <UploadCloud className="w-4 h-4 animate-pulse text-slate-400" />
            <span>Drag training video file anywhere to upload directly</span>
          </div>

        </div>
      )}

      {activeTab === "upload" && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          
          {/* Main Upload Box */}
          <div className="md:col-span-8 bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2">
              Video Uploader Zone
            </h3>

            {/* Drag drop dashboard file frame */}
            <div 
              onDragOver={handleDrag}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all relative flex flex-col items-center justify-center gap-4 group cursor-pointer
                ${dragActive 
                  ? "bg-violet-600/15 border-cyan-400" 
                  : "bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950"}`}
            >
              <input
                type="file"
                multiple
                accept="video/*"
                onChange={triggerManualFileInput}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
              />
              <div className="p-4 bg-slate-900 border border-slate-800 text-slate-400 rounded-full group-hover:scale-105 transition-all">
                <UploadCloud className="w-8 h-8 text-violet-400 fill-violet-400/5 animate-bounce" />
              </div>
              <div className="space-y-1 text-center">
                <p className="text-xs font-bold text-white">
                  Drag and drop your training video files here
                </p>
                <p className="text-[10px] text-slate-400">
                  Allows up to <strong className="text-cyan-400">500 MB</strong> files (.mp4, .mov, .mkv, .avi)
                </p>
              </div>

              <span className="bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 py-1.5 px-4 rounded-lg text-xs font-semibold select-none z-10 transition-all cursor-pointer">
                Select Files Manual
              </span>
            </div>

            {/* Form category options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Video Category</label>
                <select
                  value={videoCat}
                  onChange={(e) => setVideoCat(e.target.value)}
                  className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-lg text-xs px-3 py-2 focus:outline-none focus:border-cyan-500"
                >
                  <option value="Training Guides">Training Guides</option>
                  <option value="Kitchen Operations">Kitchen Operations</option>
                  <option value="Food Safety Guides">Food Safety Guides</option>
                  <option value="Point Of Sale POS">Point Of Sale POS</option>
                  <option value="Manager Handbooks">Manager Handbooks</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Privacy Lock</label>
                <select
                  value={videoIsPrivate ? "true" : "false"}
                  onChange={(e) => setVideoIsPrivate(e.target.value === "true")}
                  className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-lg text-xs px-3 py-2 focus:outline-none focus:border-cyan-500"
                >
                  <option value="false">Public (Entire Crew Area)</option>
                  <option value="true">Private (Trainers &amp; Leadership Only)</option>
                </select>
              </div>
            </div>

            {/* Note alert constraints */}
            <div className="bg-slate-950 border border-slate-850 p-3 rounded-xl flex items-start gap-2.5 text-[10px] text-slate-400 leading-relaxed font-mono">
              <Info className="w-4 h-4 text-cyan-400 shrink-0" />
              <div>
                <strong className="text-slate-200 font-bold">AUTOMATIC TRANSCODING:</strong> Selected guides undergo standard H.264 video codec compression rendering and segmenting pipelines. Your uploads are fully responsive and run seamlessly on mobile phones and desktop browsers.
              </div>
            </div>
          </div>

          {/* Active Uploading List Progress */}
          <div className="md:col-span-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2 flex items-center justify-between">
              Upload Progress ({Object.keys(uploadProgressList).length})
            </h3>

            {Object.keys(uploadProgressList).length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs font-mono">
                No active video uploads recorded.
              </div>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {Object.entries(uploadProgressList).map(([id, item]: [string, any]) => (
                  <div key={id} className="bg-slate-950 p-3 rounded-xl border border-violet-500/20 text-[10px] font-mono space-y-2">
                    <div className="flex items-center justify-between text-slate-300 gap-2">
                      <span className="truncate pr-1 font-bold">{item.name}</span>
                      <span className="text-violet-400 shrink-0 font-extrabold">{percentValueDisplay(item.progress)}</span>
                    </div>

                    <p className="text-[9px] text-slate-400">{item.status}</p>

                    {/* Progress slider bar representation */}
                    <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-cyan-400 to-violet-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {activeTab === "console" && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Server status pipeline cards */}
          <div className="md:col-span-8 bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-5">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2">
              Universal Processing Pipeline
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-1">
                <p className="text-[10px] font-mono text-slate-500 uppercase">Input Container Format</p>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <p className="text-xs font-extrabold text-white">Full-Device Support</p>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal pt-1">
                  Supports MP4, MOV, FLV, WEBM, MKV metadata.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-1">
                <p className="text-[10px] font-mono text-slate-500 uppercase">Video/Audio Target Codecs</p>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <p className="text-xs font-extrabold text-white">H.264 / AAC Codec Target</p>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal pt-1">
                  Transcodes streams into HTML5 native H.264 baseline profiles and stereo Advanced Audio Coding.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-1">
                <p className="text-[10px] font-mono text-slate-500 uppercase">HLS Segmenting Layout</p>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-violet-400" />
                  <p className="text-xs font-extrabold text-white">6-Second Ts Chunk Grid</p>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal pt-1">
                  Enables instantaneous HTTP seeking, resuming playheads, and buffering optimization on 4G networks.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-1">
                <p className="text-[10px] font-mono text-slate-500 uppercase">Multi-Quality Scaling</p>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-pink-400" />
                  <p className="text-xs font-extrabold text-white">Dual-Profile Adaptive (Master)</p>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal pt-1">
                  Dual presets: Standard Web (480p) and High Definition (720p) bundled into a `.m3u8` master playlist.
                </p>
              </div>
            </div>

            <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-850 space-y-2">
              <span className="bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[9px] font-bold px-2 py-0.5 rounded uppercase">
                Active Transcoder Diagnostic Log
              </span>
              <pre className="text-[9.5px] text-slate-400 font-mono bg-slate-950 p-3 rounded-lg overflow-x-auto text-left leading-normal">
                [FFmpeg-Engine] Loaded modules: child_process, fs, path, multer{"\n"}
                [FFmpeg-Engine] Active upload limit: 524,288,000 Bytes (500MB max per stream){"\n"}
                [FFmpeg-Engine] Static assets routed through secure Express range parser{"\n"}
                [FFmpeg-Engine] Syncing database status with /uploads/metadata.json
              </pre>
            </div>
          </div>

          {/* Sidebar System parameters */}
          <div className="md:col-span-4 space-y-6">
            
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2">
                Server Allocated Volume
              </h3>
              
              <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl font-mono text-[10px] text-slate-400 uppercase space-y-2">
                <p className="flex justify-between"><span>Transcoder Engine:</span> <span className="text-emerald-400 font-bold">ACTIVE (ONLINE)</span></p>
                <p className="flex justify-between"><span>Protocol Host:</span> <span className="text-slate-300">0.0.0.0 (Port 3000)</span></p>
                <p className="flex justify-between"><span>Registry Volume:</span> <span className="text-slate-200">/uploads/metadata.json</span></p>
                <p className="flex justify-between"><span>Local Storage status:</span> <span className="text-cyan-400">{serverVideos.length} hosted guides</span></p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2 flex items-center gap-1.5">
                <User className="w-4 h-4 text-cyan-400" /> Account Profile
              </h3>

              <div className="space-y-1 font-mono text-[10px] text-slate-400 leading-normal">
                <p><span className="text-slate-500">USER:</span> <strong className="text-white font-bold">{fsUser.username}</strong></p>
                <p><span className="text-slate-500">ROLE:</span> <span className="text-cyan-400 font-extrabold">{fsUser.role}</span></p>
                <p><span className="text-slate-500">CLOUD NODE ID:</span> <span className="text-slate-300">transceiver-station-04</span></p>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* Video metadata modal edit sheet overlay */}
      {editingVideo && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl relative text-left">
            <h4 className="text-sm font-bold text-cyan-400 uppercase tracking-wider border-b border-slate-800 pb-2">
              Edit Learning Module Metadata
            </h4>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-404 font-mono uppercase font-bold text-slate-400">Video Title</label>
                <input
                  type="text"
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-404 font-mono uppercase font-bold text-slate-400">Video Description</label>
                <textarea
                  rows={4}
                  value={videoDesc}
                  onChange={(e) => setVideoDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-404 font-mono uppercase font-bold text-slate-400">Category Tag</label>
                  <select
                    value={videoCat}
                    onChange={(e) => setVideoCat(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-lg p-2 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="Training Guides">Training Guides</option>
                    <option value="Kitchen Operations">Kitchen Operations</option>
                    <option value="Food Safety Guides">Food Safety Guides</option>
                    <option value="Point Of Sale POS">Point Of Sale POS</option>
                    <option value="Manager Handbooks">Manager Handbooks</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-404 font-mono uppercase font-bold text-slate-400">Lock Registry</label>
                  <select
                    value={videoIsPrivate ? "true" : "false"}
                    onChange={(e) => setVideoIsPrivate(e.target.value === "true")}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-lg p-2 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="false">Public (Show to Crew)</option>
                    <option value="true">Private (Trainers Only)</option>
                  </select>
                </div>
              </div>

              {/* Set custom high-tech glowing background thumbnail (Base64) option */}
              <div className="space-y-1 pt-1">
                <p className="text-[10px] text-slate-400 font-mono uppercase font-bold">Thumbnail Profile</p>
                <div className="flex items-center gap-3 bg-slate-950 border border-slate-850 p-2.5 rounded-xl">
                  <img 
                    src={editingVideo.thumbnail} 
                    alt="thumbnail prview" 
                    referrerPolicy="no-referrer"
                    className="w-16 aspect-video object-cover rounded border border-slate-800"
                  />
                  <div className="space-y-1">
                    <p className="text-[9px] text-slate-400 font-mono leading-tight">Glow backdrop is auto-rendered of keyframes.</p>
                    <label className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 py-1 px-2.5 rounded text-[9px] font-bold cursor-pointer transition-all">
                      Upload Custom Frame
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            const reader = new FileReader();
                            reader.onload = async (event) => {
                              const b64 = event.target?.result as string;
                              try {
                                const res = await fetch(`/api/videos/${editingVideo.id}/thumbnail`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ thumbnail: b64 })
                                });
                                if (res.ok) {
                                  setEditingVideo({ ...editingVideo, thumbnail: b64 });
                                  showToast("Thumbnail frame updated!", "success");
                                }
                              } catch (err) {
                                console.error(err);
                              }
                            };
                            reader.readAsDataURL(e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-3">
              <button
                onClick={handleSaveVideoEdits}
                className="flex-1 bg-gradient-to-r from-cyan-500 to-violet-600 font-bold uppercase tracking-wider text-white py-2 rounded-xl text-xs shadow-md cursor-pointer transition-all active:scale-95 duration-100"
              >
                Save Metrics
              </button>
              <button
                onClick={() => setEditingVideo(null)}
                className="px-4 py-2 bg-slate-950 hover:bg-slate-850 text-slate-300 rounded-xl text-xs font-semibold hover:text-white transition-all cursor-pointer border border-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline helper displays
function percentValueDisplay(progressValue: number): string {
  if (progressValue >= 100) return "100%";
  if (progressValue <= 0) return "0%";
  return `${progressValue}%`;
}
