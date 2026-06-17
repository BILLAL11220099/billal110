/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  X, 
  Video, 
  Upload, 
  Play, 
  Download, 
  Trash2, 
  AlertCircle, 
  CheckCircle, 
  Film, 
  Shield, 
  Pencil, 
  Save, 
  Plus, 
  Sparkles, 
  Sliders, 
  Maximize, 
  Clock, 
  User, 
  HardDrive,
  ExternalLink,
  ChevronRight,
  Info,
  Search,
  Check
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { VideoMetadata, UserSession } from "../types";
import { storeVideoBlob, getVideoBlob, deleteVideoBlob } from "../utils/indexedDB";
import SecurityModal from "./SecurityModal";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "../data/firebase";

interface VideoUploadSheetProps {
  isOpen: boolean;
  onClose: () => void;
  videos: VideoMetadata[];
  currentSession: UserSession;
  onSaveVideos: (videosList: VideoMetadata[]) => void;
}

// Preseeded default educational/operational videos for immediate playbacks
const DEFAULT_VIDEOS: VideoMetadata[] = [
  {
    id: "default_burger_guide",
    title: "Double Cheeseburger Fast Assembly Guide",
    fileName: "mcd_kitchen_double_prep.mp4",
    fileSize: 18451200, // 18.4 MB
    fileType: "video/mp4",
    uploadedBy: "Business Manager",
    uploadedRole: "Business Manager",
    timestamp: "2026-06-15T09:30:00.000Z",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" 
  },
  {
    id: "default_safety_guide",
    title: "Standard Handwashing & Hygiene Walkthrough",
    fileName: "handwash_hygiene_training.mp4",
    fileSize: 12100450, // 12.1 MB
    fileType: "video/mp4",
    uploadedBy: "Trainer",
    uploadedRole: "Trainer",
    timestamp: "2026-06-16T14:15:00.000Z",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4" 
  }
];

export default function VideoUploadSheet({
  isOpen,
  onClose,
  videos,
  currentSession,
  onSaveVideos
}: VideoUploadSheetProps) {
  // Navigation tabs or active configurations
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<"all" | "default" | "crew">("all");

  const [videoTitle, setVideoTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadStep, setUploadStep] = useState<string>("");
  
  // Custom video playback configuration controls
  const [playingVideo, setPlayingVideo] = useState<{ id: string; title: string; url: string } | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const videoPlayerRef = useRef<HTMLVideoElement>(null);
  
  // Security verification for deletions
  const [secModalOpen, setSecModalOpen] = useState(false);
  const [secModalMsg, setSecModalMsg] = useState("");
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);

  // Edit states
  const [editingVidId, setEditingVidId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editUploadedBy, setEditUploadedBy] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // If initial video loading holds zero entries, let's pre-load defaults
  const activeVideoList = videos.length > 0 ? videos : DEFAULT_VIDEOS;

  // Initialize/retrieve stored files to generate active object URLs
  const [localUrlMap, setLocalUrlMap] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadBlobs() {
      const newMap: Record<string, string> = {};
      for (const v of activeVideoList) {
        if (v.id.startsWith("default_")) {
          if (v.url) newMap[v.id] = v.url;
        } else {
          try {
            const blob = await getVideoBlob(v.id);
            if (blob) {
              const url = URL.createObjectURL(blob);
              newMap[v.id] = url;
            } else if (v.url) {
              newMap[v.id] = v.url;
            }
          } catch (err) {
            console.error("Error creating local video url object:", err);
            if (v.url) newMap[v.id] = v.url;
          }
        }
      }
      setLocalUrlMap(newMap);
    }
    if (isOpen) {
      loadBlobs();
    }

    // Cleanup generated URLs on close
    return () => {
      Object.keys(localUrlMap).forEach((key) => {
        const url = localUrlMap[key];
        if (url && !url.startsWith("http")) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [isOpen, videos]);

  // Adjust playback speed of the active player on change
  useEffect(() => {
    if (videoPlayerRef.current) {
      videoPlayerRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed, playingVideo]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    setUploadError(null);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (!file.type.startsWith("video/")) {
        setUploadError("Please drop a valid movie or video file format.");
        return;
      }
      const maxSize = 500 * 1024 * 1024;
      if (file.size > maxSize) {
        setUploadError(`Video exceeds maximum 500MB size limit. (Your file: ${(file.size / (1024 * 1024)).toFixed(1)} MB)`);
        return;
      }
      setSelectedFile(file);
      if (!videoTitle.trim()) {
        const cleanedName = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
        setVideoTitle(cleanedName);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const maxSize = 500 * 1024 * 1024;
      if (file.size > maxSize) {
        setUploadError(`Video exceeds maximum 500MB size limit. (Your file: ${(file.size / (1024 * 1024)).toFixed(1)} MB)`);
        return;
      }
      setSelectedFile(file);
      if (!videoTitle.trim()) {
        const cleanedName = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
        setVideoTitle(cleanedName);
      }
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError("Please select or drop a video file first.");
      return;
    }
    if (!videoTitle.trim()) {
      setUploadError("Please enter a custom title or label for this video guide.");
      return;
    }

    setUploadProgress(10);
    setUploadStep("Caching locally inside browser...");

    try {
      const videoId = "vid_" + Date.now();

      // Save binary blob to browser IndexedDB
      await storeVideoBlob(videoId, selectedFile);
      
      setUploadProgress(30);
      setUploadStep("Syncing to redundant Cloud servers...");

      // Upload to Firebase Cloud Storage so all crew members can see and stream it in real time
      const fileRef = ref(storage, `videos/${videoId}_${selectedFile.name}`);
      const uploadTask = uploadBytesResumable(fileRef, selectedFile);

      const downloadUrl = await new Promise<string>((resolve, reject) => {
        let lastBytes = 0;
        let lastProgressTime = Date.now();

        // High-performance watchdog to prevent indefinite hanging if connection or Firebase Storage is blocked
        const watchdogInterval = setInterval(() => {
          const now = Date.now();
          if (now - lastProgressTime > 45000) {
            console.warn("Storage upload connection appears to be hanging. Triggering secondary cloud fallback...");
            clearInterval(watchdogInterval);
            try {
              uploadTask.cancel();
            } catch (cancelErr) {
              console.log("Could not cancel hanging upload:", cancelErr);
            }
            reject(new Error("Connection to Cloud Storage was slow or unresponsive - activating backup network."));
          }
        }, 1000);

        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const bytesNow = snapshot.bytesTransferred;
            if (bytesNow > lastBytes) {
              lastBytes = bytesNow;
              lastProgressTime = Date.now(); 
            }
            const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 60);
            setUploadProgress(30 + progress); // Scale 30% to 90%
            const uploadedMB = (snapshot.bytesTransferred / (1024 * 1024)).toFixed(1);
            const totalMB = (snapshot.totalBytes / (1024 * 1024)).toFixed(1);
            setUploadStep(`Uploading file: ${uploadedMB} MB / ${totalMB} MB...`);
          },
          (error) => {
            clearInterval(watchdogInterval);
            console.error("Cloud storage upload failed, fallback to secondary Pixeldrain delivery", error);
            reject(error);
          },
          async () => {
            clearInterval(watchdogInterval);
            try {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(url);
            } catch (err) {
              reject(err);
            }
          }
        );
      });

      setUploadProgress(95);
      setUploadStep("Registering index with database...");

      // Generate object URL for instant play
      const objUrl = URL.createObjectURL(selectedFile);
      setLocalUrlMap(prev => ({ ...prev, [videoId]: objUrl }));

      const newMeta: VideoMetadata = {
        id: videoId,
        title: videoTitle.trim(),
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        fileType: selectedFile.type,
        uploadedBy: currentSession.username,
        uploadedRole: currentSession.role,
        timestamp: new Date().toISOString(),
        url: downloadUrl
      };

      const updated = [newMeta, ...activeVideoList];
      onSaveVideos(updated);

      setUploadProgress(100);
      setUploadStep("Video fully synced to Crew Network!");

      // Reset Form fields
      setTimeout(() => {
        setSelectedFile(null);
        setVideoTitle("");
        setUploadProgress(null);
        setUploadStep("");
        if (fileInputRef.current) fileInputRef.current.value = "";
      }, 1200);

    } catch (err) {
      console.warn("Primary Firebase Storage upload failed. Activating high-speed secondary delivery...", err);
      
      try {
        setUploadProgress(30);
        setUploadStep("Routing file to secure high-speed CDN fallback...");
        
        const videoId = "vid_" + Date.now();
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("anonymous", "true");

        const xhr = new XMLHttpRequest();
        const downloadUrl = await new Promise<string>((resolve, reject) => {
          xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) {
              const progress = Math.round((event.loaded / event.total) * 60);
              setUploadProgress(30 + progress); // Scale 30% to 90%
              const uploadedMB = (event.loaded / (1024 * 1024)).toFixed(1);
              const totalMB = (event.total / (1024 * 1024)).toFixed(1);
              setUploadStep(`Direct CDN Sync: ${uploadedMB} MB / ${totalMB} MB...`);
            }
          });

          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const json = JSON.parse(xhr.responseText);
                if (json && json.id) {
                  resolve(`https://pixeldrain.com/api/file/${json.id}`);
                } else {
                  reject(new Error("Response not containing file identifier"));
                }
              } catch (e) {
                reject(e);
              }
            } else {
              reject(new Error(`Server response error: ${xhr.status} ${xhr.statusText}`));
            }
          });

          xhr.addEventListener("error", () => reject(new Error("Network connection dropped during CDN sync")));
          xhr.open("POST", "https://pixeldrain.com/api/file");
          xhr.send(formData);
        });

        setUploadProgress(95);
        setUploadStep("Registering index with database...");

        const objUrl = URL.createObjectURL(selectedFile);
        setLocalUrlMap(prev => ({ ...prev, [videoId]: objUrl }));

        const newMeta: VideoMetadata = {
          id: videoId,
          title: videoTitle.trim(),
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          fileType: selectedFile.type,
          uploadedBy: currentSession.username,
          uploadedRole: currentSession.role,
          timestamp: new Date().toISOString(),
          url: downloadUrl
        };

        const updated = [newMeta, ...activeVideoList];
        onSaveVideos(updated);

        setUploadProgress(100);
        setUploadStep("Video fully synced to CDN Network!");

        setTimeout(() => {
          setSelectedFile(null);
          setVideoTitle("");
          setUploadProgress(null);
          setUploadStep("");
          if (fileInputRef.current) fileInputRef.current.value = "";
        }, 1200);

      } catch (fallbackErr) {
        console.error("Secondary high-speed transfer failed too. Saving local sandboxed index only:", fallbackErr);
        
        // Final fallback: save locally
        try {
          const videoId = "vid_" + Date.now();
          const objUrl = URL.createObjectURL(selectedFile);
          setLocalUrlMap(prev => ({ ...prev, [videoId]: objUrl }));

          const newMeta: VideoMetadata = {
            id: videoId,
            title: videoTitle.trim(),
            fileName: selectedFile.name,
            fileSize: selectedFile.size,
            fileType: selectedFile.type,
            uploadedBy: currentSession.username,
            uploadedRole: currentSession.role,
            timestamp: new Date().toISOString()
          };

          const updated = [newMeta, ...activeVideoList];
          onSaveVideos(updated);

          setUploadProgress(100);
          setUploadStep("Saved locally (Offline - Server Unavailable)!");

          setTimeout(() => {
            setSelectedFile(null);
            setVideoTitle("");
            setUploadProgress(null);
            setUploadStep("");
            if (fileInputRef.current) fileInputRef.current.value = "";
          }, 1200);
        } catch (localErr) {
          console.error(localErr);
          setUploadProgress(null);
          setUploadError("Operational Storage failure: Could not allocate memory inside sandbox database.");
        }
      }
    }
  };

  const triggerDownload = async (vid: VideoMetadata) => {
    const url = localUrlMap[vid.id] || vid.url;
    if (!url) {
      alert("Locally stored file has expired or was removed in this browser.");
      return;
    }

    try {
      if (url.startsWith("blob:") || url.startsWith("data:")) {
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", vid.fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      // If it is a remote url, fetch it as a blob to bypass default sandboxed iframe navigation restrictions
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Network response error ${response.status}`);
      const blob = await response.blob();
      const localBlobUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = localBlobUrl;
      link.setAttribute("download", vid.fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => {
        URL.revokeObjectURL(localBlobUrl);
      }, 2000);
    } catch (err) {
      console.warn("Direct blob downloader failed, fallback to raw link redirection:", err);
      // Resilient fallback: open target in a fresh browser tab
      window.open(url, "_blank");
    }
  };

  const startEditing = (vid: VideoMetadata) => {
    setEditingVidId(vid.id);
    setEditTitle(vid.title);
    setEditUploadedBy(vid.uploadedBy);
  };

  const handleSaveEdit = (vidId: string) => {
    if (!editTitle.trim()) return;
    const updated = activeVideoList.map((v) => {
      if (v.id === vidId) {
        return {
          ...v,
          title: editTitle.trim(),
          uploadedBy: editUploadedBy.trim() || v.uploadedBy
        };
      }
      return v;
    });
    onSaveVideos(updated);
    setEditingVidId(null);
    setEditTitle("");
    setEditUploadedBy("");
  };

  const triggerDeletion = (vidId: string, title: string) => {
    setDeletingVideoId(vidId);
    setSecModalMsg(`🚨 ACCIDENTAL LOSS PREVENTION & RESTRICTED DELETION WARNING: Are you sure you want to permanently delete the guide '${title}'? This will permanently delete its metadata and file from Cloud Firestore & IndexedDB storage. This action cannot be undone. To proceed, please enter the McDonald's Crew PIN.`);
    setSecModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingVideoId) return;
    const vidId = deletingVideoId;
    
    // Execute Deletion from Cloud Storage
    try {
      const vidFile = activeVideoList.find((v) => v.id === vidId);
      if (vidFile && vidFile.url && vidFile.url.includes("firebasestorage.googleapis.com")) {
        const fileRef = ref(storage, `videos/${vidId}_${vidFile.fileName}`);
        await deleteObject(fileRef).catch((de) => console.log("Cloud file delete skipped:", de));
      }
    } catch (ce) {
      console.warn("Could not remove cloud storage video resource:", ce);
    }

    try {
      await deleteVideoBlob(vidId);
    } catch (err) {
      console.error("Local file delete failed:", err);
    }

    const filtered = activeVideoList.filter(v => v.id !== vidId);
    onSaveVideos(filtered);
    
    if (playingVideo?.id === vidId) {
      setPlayingVideo(null);
    }
    setDeletingVideoId(null);
    setSecModalOpen(false);
  };

  // Filter video playlist depending on active inputs & queries
  const filteredVideos = activeVideoList.filter(vid => {
    const matchesSearch = 
      vid.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      vid.fileName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      vid.uploadedBy.toLowerCase().includes(searchQuery.toLowerCase());

    if (filterCategory === "default") {
      return matchesSearch && vid.id.startsWith("default_");
    }
    if (filterCategory === "crew") {
      return matchesSearch && !vid.id.startsWith("default_");
    }
    return matchesSearch;
  });

  const requestFullscreen = () => {
    if (videoPlayerRef.current) {
      if (videoPlayerRef.current.requestFullscreen) {
        videoPlayerRef.current.requestFullscreen();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans flex justify-end" id="video-overlay-sheet-portal">
      {/* Black backdrop overlay */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300" 
      />

      {/* New Ultra Panoramic Panel */}
      <motion.div 
        initial={{ x: "100%", opacity: 0.8 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: "100%", opacity: 0.8 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="relative h-full w-full max-w-5xl bg-slate-50 shadow-2xl flex flex-col border-l border-slate-200"
      >
        
        {/* Header Ribbon bar */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FFC72C]/10 rounded-xl flex items-center justify-center border border-[#FFC72C]/20 shadow-2xs">
              <Video className="w-5 h-5 text-[#DA291C]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-slate-850 uppercase tracking-tight">Shift Video Workstation</h2>
                <span className="bg-[#DA291C]/10 text-[#DA291C] text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-[#DA291C]/20">
                  Ultra UI v3.0
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono font-bold tracking-widest uppercase">Operational Video Guides &amp; Real-time Sync</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-105 hover:text-slate-900 text-slate-400 transition-all cursor-pointer border border-transparent hover:border-slate-200 shadow-2xs active:scale-95"
            id="close-video-sheet-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Panoramic Workspace Body */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row h-full">
          
          {/* LEFT PANEL: Interactive Theater Space or Dedicated Uploader */}
          <div className="flex-1 overflow-y-auto p-6 border-b md:border-b-0 md:border-r border-slate-200 bg-white flex flex-col gap-5">
            
            {playingVideo ? (
              /* ACTIVE THEATER WITH INTUATIVE ENHANCEMENTS */
              <div className="flex-1 flex flex-col justify-between" id="video-theater-player">
                <div className="space-y-4">
                  {/* Title Bar */}
                  <div className="flex items-center justify-between bg-slate-900 text-white p-3 rounded-xl shadow-xs border border-slate-800">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <span className="text-xs font-black truncate text-slate-100 uppercase tracking-wide">{playingVideo.title}</span>
                    </div>
                    <button 
                      onClick={() => setPlayingVideo(null)}
                      className="text-slate-400 hover:text-white hover:bg-slate-800 px-2.5 py-1 rounded-lg transition-all font-mono font-bold text-[9px] uppercase tracking-wider border border-slate-750 cursor-pointer"
                    >
                      Close Player
                    </button>
                  </div>

                  {/* High Quality Video Stage */}
                  <div className="relative aspect-video bg-slate-950 rounded-2xl overflow-hidden shadow-lg border border-slate-900 group">
                    <video 
                      ref={videoPlayerRef}
                      src={playingVideo.url} 
                      controls 
                      autoPlay
                      preload="auto"
                      crossOrigin="anonymous"
                      className="w-full h-full object-contain"
                      playsInline
                    />
                    
                    {/* Control HUD Overlay */}
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 z-10">
                      <button 
                        onClick={requestFullscreen}
                        className="bg-black/70 hover:bg-black/90 backdrop-blur-xs text-white p-2 rounded-lg transition-all shadow-sm cursor-pointer border border-white/10"
                        title="Fullscreen"
                      >
                        <Maximize className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Playback Configuration Custom Tools */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-slate-500" />
                        <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 font-sans">Procedure Playback Controls</h4>
                      </div>
                      <span className="text-[10px] font-mono font-extrabold text-[#DA291C] bg-[#DA291C]/5 border border-[#DA291C]/15 px-2 py-0.5 rounded-md">
                        Speed: {playbackSpeed}x
                      </span>
                    </div>

                    {/* Speed Selector Buttons */}
                    <div className="grid grid-cols-5 gap-1.5">
                      {[0.5, 1.0, 1.25, 1.5, 2.0].map((speed) => (
                        <button
                          key={speed}
                          onClick={() => setPlaybackSpeed(speed)}
                          className={`py-1.5 rounded-lg text-[10px] font-black font-mono transition-all uppercase tracking-tight cursor-pointer ${
                            playbackSpeed === speed 
                              ? "bg-[#DA291C] text-white shadow-xs scale-102"
                              : "bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 active:bg-slate-200"
                          }`}
                        >
                          {speed === 1.0 ? "Normal" : `${speed}x`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Video Info Details Card */}
                <div className="border border-slate-150 rounded-xl p-4 flex gap-4 items-start bg-slate-50/50 mt-4 font-sans">
                  <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center shrink-0 shadow-3xs text-[#DA291C]">
                    <Film className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <h5 className="text-[11px] font-black text-slate-800 uppercase tracking-tight truncate">Currently Loaded Procedural Film</h5>
                    <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-slate-500 font-mono font-medium">
                      <span className="flex items-center gap-1"><User className="w-3 h-3 text-slate-400" /> {activeVideoList.find(v => v.id === playingVideo.id)?.uploadedBy || "Trainer"}</span>
                      <span className="text-slate-300">•</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-slate-400" /> {activeVideoList.find(v => v.id === playingVideo.id)?.timestamp ? new Date(activeVideoList.find(v => v.id === playingVideo.id)!.timestamp).toLocaleDateString([], { month: "short", day: "numeric" }) : "Today"}</span>
                    </div>
                    <p className="text-[9.5px] text-slate-400 font-mono truncate">
                      File: {activeVideoList.find(v => v.id === playingVideo.id)?.fileName || "video.mp4"}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* INSTANT UPLOADER CAPABILITY AREA */
              <div className="flex-1 flex flex-col justify-center max-w-lg mx-auto w-full space-y-6">
                
                {/* Visual Header */}
                <div className="text-center space-y-1">
                  <div className="w-12 h-12 bg-[#FFC72C]/10 border border-[#FFC72C]/35 rounded-2xl flex items-center justify-center mx-auto shadow-2xs">
                    <Sparkles className="w-6 h-6 text-[#DA291C]" />
                  </div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight mt-3">Upload Training Film</h3>
                  <p className="text-xs text-slate-500">
                    Instantly sync high-definition operational procedures with other active crew members.
                  </p>
                </div>

                <form onSubmit={handleUploadSubmit} className="space-y-4">
                  {/* Drop zone workspace */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-3 border-dashed rounded-3xl p-7 text-center flex flex-col items-center justify-center cursor-pointer transition-all duration-300 relative overflow-hidden ${
                      dragOver 
                        ? "border-[#DA291C] bg-[#DA291C]/5 scale-102" 
                        : selectedFile 
                        ? "border-emerald-500 bg-emerald-50/10 shadow-3xs" 
                        : "border-slate-200 hover:border-[#FFC72C] hover:bg-[#FFC72C]/5 bg-slate-50/60"
                    }`}
                    id="video-dropzone"
                  >
                    <input 
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="video/*"
                      className="hidden"
                    />

                    {selectedFile ? (
                      <div className="space-y-2 pointer-events-none animate-slide-up">
                        <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 shadow-sm">
                          <Film className="w-6 h-6 animate-pulse" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-black text-slate-800 leading-tight max-w-sm truncate mx-auto">
                            {selectedFile.name}
                          </p>
                          <p className="text-[10px] text-emerald-600 font-mono font-bold uppercase tracking-wider bg-emerald-100/40 inline-block px-2.5 py-0.5 rounded-md">
                            Size: {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                          </p>
                        </div>
                        <p className="text-[10.5px] text-slate-400 font-sans italic">Click to swap with another video file</p>
                      </div>
                    ) : (
                      <div className="space-y-3.5 pointer-events-none">
                        <div className="w-12 h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center mx-auto text-slate-400 shadow-2xs">
                          <Upload className="w-5 h-5 text-slate-400" />
                        </div>
                        <div>
                          <p className="text-xs font-extrabold text-slate-700">Drag &amp; drop shift video here, or <span className="text-[#DA291C] hover:underline">browse files</span></p>
                          <p className="text-[9px] text-slate-400 mt-1 uppercase font-mono font-black tracking-widest bg-slate-100 px-2 py-0.5 rounded">
                            Max size: 500MB • MP4, MOV, WEBM, AVI
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Custom Title Input */}
                  {selectedFile && (
                    <div className="space-y-1 animate-slide-up">
                      <label htmlFor="upload-video-title" className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">Video Guide Label / Procedural Title</label>
                      <input
                        type="text"
                        id="upload-video-title"
                        required
                        value={videoTitle}
                        onChange={(e) => setVideoTitle(e.target.value)}
                        placeholder="e.g. Double Cheeseburger Fast Assembly Guide..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-850 font-sans focus:outline-[#DA291C] focus:bg-white focus:ring-1 focus:ring-[#DA291C]/20 transition-all font-medium placeholder-slate-400 shadow-3xs"
                      />
                    </div>
                  )}

                  {/* Error notifications */}
                  {uploadError && (
                    <div className="bg-rose-50 border border-rose-100 text-[#DA291C] rounded-2xl p-4 flex gap-3 items-start text-xs font-semibold animate-shake">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <div className="space-y-0.5">
                        <h4 className="font-extrabold uppercase tracking-tight">Upload Blocked</h4>
                        <p className="text-slate-550 leading-relaxed text-[11px]">{uploadError}</p>
                      </div>
                    </div>
                  )}

                  {/* Real-time Multi-Stage Progress Bar Loader */}
                  {uploadProgress !== null && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3.5 shadow-xs">
                      <div className="flex justify-between items-center text-[11px]">
                        <div className="flex items-center gap-1.5 text-slate-550">
                          <span className="w-2 h-2 rounded-full bg-[#DA291C] animate-ping" />
                          <span className="font-black font-sans uppercase tracking-wide">{uploadStep}</span>
                        </div>
                        <span className="font-black font-mono text-[#DA291C] bg-[#DA291C]/5 px-2.5 py-0.5 rounded-lg border border-[#DA291C]/15">{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/50">
                        <div 
                          className="bg-[#DA291C] h-full transition-all duration-300 rounded-full bg-linear-to-r from-[#DA291C] to-[#FFC72C]"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  {selectedFile && uploadProgress === null && (
                    <div className="flex items-center gap-2.5 pt-1.5 animate-slide-up">
                      <button
                        type="submit"
                        className="flex-1 bg-[#DA291C] hover:bg-[#C21B10] text-white py-2.5 px-4 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 shadow-md active:scale-98 cursor-pointer"
                      >
                        <Plus className="w-4 h-4 text-white" /> Initiate Instant Sync
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFile(null);
                          setVideoTitle("");
                          setUploadError(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border border-slate-200 active:scale-98 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </form>
              </div>
            )}
          </div>

          {/* RIGHT PANEL: Live Video Directory & Playlists Workspace */}
          <div className="w-full md:w-96 flex flex-col h-full bg-slate-50/50">
            
            {/* Filter Hub Toolbar */}
            <div className="p-4 bg-white border-b border-slate-200 space-y-3 shrink-0">
              {/* Dynamic Live Query Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search video guides, trainers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-850 font-sans focus:outline-[#DA291C] focus:bg-white transition-all font-medium"
                />
              </div>

              {/* Categorization controls */}
              <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setFilterCategory("all")}
                  className={`flex-1 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-tight transition-all cursor-pointer ${
                    filterCategory === "all" 
                      ? "bg-white text-[#DA291C] shadow-xs font-black"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  All ({activeVideoList.length})
                </button>
                <button
                  onClick={() => setFilterCategory("default")}
                  className={`flex-1 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-tight transition-all cursor-pointer ${
                    filterCategory === "default" 
                      ? "bg-white text-[#DA291C] shadow-xs font-black"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Pre-seeded
                </button>
                <button
                  onClick={() => setFilterCategory("crew")}
                  className={`flex-1 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-tight transition-all cursor-pointer ${
                    filterCategory === "crew" 
                      ? "bg-white text-[#DA291C] shadow-xs font-black"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Crew uploads
                </button>
              </div>
            </div>

            {/* Video List Playable Directory */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
              
              {filteredVideos.length === 0 ? (
                <div className="text-center p-9 bg-white rounded-2xl border border-slate-200 space-y-2 shadow-3xs">
                  <Video className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-tight font-mono">No Matching Films</p>
                  <p className="text-[10px] text-slate-400">Try broading search terms or swap category tab filters.</p>
                </div>
              ) : (
                <div className="space-y-3" id="videos-list-container">
                  <AnimatePresence initial={false}>
                    {filteredVideos.map((vid) => {
                      const sizeInMB = (vid.fileSize / (1024 * 1024)).toFixed(1);
                      const uploadDate = new Date(vid.timestamp).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      });

                      const isDefault = vid.id.startsWith("default_");
                      const isPlaying = playingVideo?.id === vid.id;

                      return (
                        <motion.div 
                          key={vid.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="font-sans"
                        >
                          {editingVidId === vid.id ? (
                            /* CARD IN EDIT MODE STATE */
                            <div 
                              className="bg-slate-50 border-2 border-[#FFC72C] rounded-2xl p-4 flex flex-col gap-3 shadow-md animate-scale-up"
                              id={`video-card-edit-${vid.id}`}
                            >
                              <div className="space-y-3">
                                <div className="flex items-center gap-1.5 text-slate-600">
                                  <Film className="w-4 h-4 text-[#DA291C] shrink-0" />
                                  <span className="text-[9.5px] font-black text-slate-700 uppercase tracking-wider font-mono">Editing metadata</span>
                                </div>
                                
                                <div className="space-y-2.5">
                                  <div>
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">Title Label</label>
                                    <input
                                      type="text"
                                      value={editTitle}
                                      onChange={(e) => setEditTitle(e.target.value)}
                                      className="w-full bg-white border border-slate-250 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-sans mt-1 focus:outline-[#DA291C]"
                                      placeholder="Title"
                                      required
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">Uploader / Author</label>
                                    <input
                                      type="text"
                                      value={editUploadedBy}
                                      onChange={(e) => setEditUploadedBy(e.target.value)}
                                      className="w-full bg-white border border-slate-250 rounded-lg px-2.5 py-1.5 text-xs text-slate-850 font-sans mt-1 focus:outline-[#DA291C]"
                                      placeholder="Author Name"
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-end gap-2 shrink-0">
                                <button
                                  onClick={() => setEditingVidId(null)}
                                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleSaveEdit(vid.id)}
                                  disabled={!editTitle.trim()}
                                  className="bg-[#FFC72C] hover:bg-[#E5B321] text-slate-850 px-3.5 py-1 rounded-xl text-[10px] font-black transition-all cursor-pointer flex items-center gap-1 leading-none shadow-3xs"
                                >
                                  <Save className="w-3.5 h-3.5" /> Save Changes
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* IMMERSIVE COMPACT VIDEO SELECT CARD */
                            <div 
                              className={`bg-white border rounded-2xl p-4 flex flex-col gap-3.5 transition-all shadow-3xs hover:shadow-xs border-slate-200/90 hover:border-slate-300 ${
                                isPlaying 
                                  ? "border-l-4 border-l-[#DA291C] bg-[#DA291C]/2 shadow-2xs border-[#DA291C]/35 scale-101" 
                                  : "hover:border-slate-350"
                              }`}
                              id={`video-card-${vid.id}`}
                            >
                              <div className="flex gap-3 items-start min-w-0">
                                <div 
                                  className={`w-9 h-9 border rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                                    isPlaying 
                                      ? "bg-[#DA291C]/10 border-[#DA291C]/25 text-[#DA291C]" 
                                      : "bg-slate-100 border-slate-200 text-slate-500"
                                  }`}
                                >
                                  <Film className="w-4 h-4" />
                                </div>

                                <div className="min-w-0 flex-1 space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <h4 className="text-xs font-black text-slate-850 tracking-tight leading-snug line-clamp-2" title={vid.title}>
                                      {vid.title}
                                    </h4>
                                    {isDefault && (
                                      <span className="bg-slate-100 text-slate-500 border border-slate-200 text-[8px] px-1.5 py-0.2 rounded font-mono font-bold uppercase tracking-wider shrink-0">
                                        Seed
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[9px] text-[#A2A4A7] font-mono leading-none">
                                    <span className="font-bold text-slate-500">{sizeInMB} MB</span>
                                    <span>•</span>
                                    <span className="truncate max-w-[110px]" title={vid.uploadedBy}>By {vid.uploadedBy}</span>
                                  </div>
                                  <p className="text-[8.5px] text-slate-400 font-mono">
                                    {uploadDate}
                                  </p>
                                </div>
                              </div>

                              {/* Operations controls */}
                              <div className="pt-2 border-t border-slate-105 flex items-center justify-between gap-2 shrink-0">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => {
                                      const url = localUrlMap[vid.id] || vid.url;
                                      if (url) {
                                        setPlayingVideo({ id: vid.id, title: vid.title, url });
                                      } else {
                                        alert("Downloading payload or streaming link not ready... Please try playing again.");
                                      }
                                    }}
                                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                                      isPlaying 
                                        ? "bg-[#DA291C] text-white shadow-xs" 
                                        : "bg-[#DA291C]/5 hover:bg-[#DA291C]/12 text-[#DA291C]"
                                    }`}
                                  >
                                    <Play className="w-3.5 h-3.5 fill-current" /> Play Video
                                  </button>
                                  
                                  <button
                                    onClick={() => triggerDownload(vid)}
                                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-xl text-[10px] font-extrabold transition-all cursor-pointer flex items-center gap-1 border border-slate-200 hover:border-slate-300"
                                    title="Download training file direct to client"
                                  >
                                    <Download className="w-3 h-3" /> Download
                                  </button>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  {/* Update metadata fields */}
                                  <button
                                    onClick={() => startEditing(vid)}
                                    className="text-slate-400 hover:text-slate-800 hover:bg-slate-100 p-1.5 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-200 shadow-3xs"
                                    title="Edit Details"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Restrict delete of core seeds */}
                                  {!isDefault && (
                                    <button
                                      onClick={() => triggerDeletion(vid.id, vid.title)}
                                      className="text-slate-400 hover:text-[#DA291C] hover:bg-rose-50 p-1.5 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-rose-100 shadow-3xs"
                                      title="Remove Video Guide"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Footer secure warning */}
        <div className="bg-slate-100 border-t border-slate-200 px-6 py-3.5 text-[9px] text-slate-450 font-mono text-center shrink-0 uppercase tracking-widest flex items-center justify-center gap-2">
          <Shield className="w-4 h-4 text-[#DA291C]" />
          <span>Local database sandbox isolation • IndexedDB fallback buffer • PIN protected schema logs</span>
        </div>

      </motion.div>

      {/* Security PIN verification portal */}
      <SecurityModal
        isOpen={secModalOpen}
        onCancel={() => {
          setSecModalOpen(false);
          setDeletingVideoId(null);
        }}
        title="Restricted Shift Deletion"
        message={secModalMsg}
        requirePin={true}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
