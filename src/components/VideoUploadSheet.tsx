/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { X, Video, Upload, Play, Download, Trash2, AlertCircle, CheckCircle, Film, RefreshCw, HardDrive, Shield } from "lucide-react";
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
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" // Stable fallback
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
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4" // Stable fallback
  }
];

export default function VideoUploadSheet({
  isOpen,
  onClose,
  videos,
  currentSession,
  onSaveVideos
}: VideoUploadSheetProps) {
  const [videoTitle, setVideoTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadStep, setUploadStep] = useState<string>("");
  
  // Player state
  const [playingVideo, setPlayingVideo] = useState<{ id: string; title: string; url: string } | null>(null);
  
  // Security verification for deletions
  const [secModalOpen, setSecModalOpen] = useState(false);
  const [secModalMsg, setSecModalMsg] = useState("");
  const [secConfirmCallback, setSecConfirmCallback] = useState<(() => void) | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // If initial video loading holds zero entries, let's pre-load defaults
  const activeVideoList = videos.length > 0 ? videos : [];

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
      // 500MB validation check (500 * 1024 * 1024 bytes)
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
      setUploadStep("Uploading file directly to Cloud Storage (friends can sync immediately)...");

      // Upload to Firebase Cloud Storage so all crew members can see and stream it in real time
      const fileRef = ref(storage, `videos/${videoId}_${selectedFile.name}`);
      const uploadTask = uploadBytesResumable(fileRef, selectedFile);

      const downloadUrl = await new Promise<string>((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 60);
            setUploadProgress(30 + progress); // Scale 30% to 90%
            const uploadedMB = (snapshot.bytesTransferred / (1024 * 1024)).toFixed(1);
            const totalMB = (snapshot.totalBytes / (1024 * 1024)).toFixed(1);
            setUploadStep(`Uploading to Server: ${uploadedMB} MB / ${totalMB} MB...`);
          },
          (error) => {
            console.error("Cloud storage upload failed, fallback to local only", error);
            reject(error);
          },
          async () => {
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
      setUploadStep("Saving metadata records in Cloud database...");

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
      setUploadStep("Video synced successfully!");

      // Reset Form fields
      setTimeout(() => {
        setSelectedFile(null);
        setVideoTitle("");
        setUploadProgress(null);
        setUploadStep("");
        if (fileInputRef.current) fileInputRef.current.value = "";
      }, 1000);

    } catch (err) {
      console.error(err);
      
      // Fallback: save local metadata if cloud storage fails
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
        setUploadStep("Complete (Local Only)!");

        setTimeout(() => {
          setSelectedFile(null);
          setVideoTitle("");
          setUploadProgress(null);
          setUploadStep("");
          if (fileInputRef.current) fileInputRef.current.value = "";
        }, 1000);
      } catch (fallbackErr) {
        console.error(fallbackErr);
        setUploadProgress(null);
        setUploadError("Operational Storage failure: Could not allocate memory inside sandbox database.");
      }
    }
  };

  const triggerDownload = async (vid: VideoMetadata) => {
    const url = localUrlMap[vid.id] || vid.url;
    if (!url) {
      alert("Locally stored file has expired or was removed in this browser.");
      return;
    }

    // Create a link and click it
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", vid.fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const triggerDeletion = (vidId: string, title: string) => {
    setSecModalMsg(`You must verify the McDonald's Crew Pin to remove the shift video guide '${title}'. This ensures other crew members don't lose operational learning procedures.`);
    setSecConfirmCallback(() => async () => {
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

      deleteVideoBlob(vidId).catch(console.error);
      const filtered = activeVideoList.filter(v => v.id !== vidId);
      onSaveVideos(filtered);
      if (playingVideo?.id === vidId) {
        setPlayingVideo(null);
      }
      setSecModalOpen(false);
    });
    setSecModalOpen(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans" id="video-overlay-sheet-portal">
      {/* Black backdrop overlay */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300" 
      />

      {/* Drawer content */}
      <div className="absolute inset-y-0 right-0 max-w-xl w-full bg-slate-50 shadow-2xl flex flex-col h-full border-l border-slate-200 animate-slide-in">
        
        {/* Header Ribbon bar */}
        <div className="bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-[#FFC72C]/10 rounded-xl flex items-center justify-center">
              <Video className="w-5 h-5 text-[#DA291C]" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-850">Shift Video Hub</h2>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono font-bold">Training &amp; Quality Guides</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            id="close-video-sheet-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body layout container */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* THEATER PLAYBACK PANEL (Locks only if active) */}
          {playingVideo && (
            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-3 shadow-lg" id="video-theater-player">
              <div className="flex items-center justify-between text-white pb-1.5 px-1 bg-slate-950">
                <div className="flex items-center gap-2 min-w-0">
                  <Film className="w-4 h-4 text-[#FFC72C] shrink-0" />
                  <span className="text-xs font-bold truncate text-slate-100 font-sans pr-4">{playingVideo.title}</span>
                </div>
                <button 
                  onClick={() => setPlayingVideo(null)}
                  className="text-slate-400 hover:text-white hover:bg-slate-800/80 p-1 rounded-md transition-colors font-mono font-extrabold text-[10px] uppercase cursor-pointer"
                >
                  Close Player
                </button>
              </div>

              <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-slate-750">
                <video 
                  src={playingVideo.url} 
                  controls 
                  autoPlay
                  className="w-full h-full object-contain"
                  playsInline
                />
              </div>
            </div>
          )}

          {/* SECTION 1: THE VIDEO DRAG/DROP FILE UPLOADER */}
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-3xs space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-0.5">
                <h3 className="text-xs font-extrabold text-slate-800">Add New Training Film</h3>
                <p className="text-[10.5px] text-slate-500 leading-normal">
                  Upload custom videos (any format supported) directly into the app catalog sandbox. Maximum file size is <strong className="text-slate-700">500MB</strong>.
                </p>
              </div>
              <span className="text-[9px] uppercase font-bold text-slate-400 border border-slate-200 px-2 py-0.5 rounded-md font-mono bg-slate-50 shrink-0">
                Max 500MB
              </span>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-3.5">
              {/* Drop box zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-5 text-center flex flex-col items-center justify-center cursor-pointer transition-all ${
                  dragOver 
                    ? "border-[#FFC72C] bg-[#FFC72C]/5" 
                    : selectedFile 
                    ? "border-emerald-500/60 bg-emerald-50/15" 
                    : "border-slate-200 hover:border-slate-350 bg-slate-50/40 hover:bg-slate-50/90"
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
                  <div className="space-y-1.5 pointer-events-none">
                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                      <Film className="w-5 h-5 animate-pulse" />
                    </div>
                    <p className="text-xs font-bold text-emerald-800 leading-tight truncate max-w-sm">
                      {selectedFile.name}
                    </p>
                    <p className="text-[10px] text-emerald-600 font-mono">
                      Size: {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB - Ready to submit
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 pointer-events-none">
                    <div className="w-10 h-10 bg-slate-100 border border-slate-200 rounded-full flex items-center justify-center mx-auto text-slate-400">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700">Drag &amp; drop video here, or <span className="text-[#DA291C] hover:underline">browse files</span></p>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase font-mono font-bold">Supports .mp4, .mov, etc.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Custom Title Input */}
              {selectedFile && (
                <div className="space-y-1 animate-slide-up">
                  <label htmlFor="upload-video-title" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Video Guide Label / Title</label>
                  <input
                    type="text"
                    id="upload-video-title"
                    required
                    value={videoTitle}
                    onChange={(e) => setVideoTitle(e.target.value)}
                    placeholder="e.g. Prep procedures, Fries multiplier guide..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-850 focus:outline-[#FFC72C] focus:bg-white font-sans"
                  />
                </div>
              )}

              {/* Error messages */}
              {uploadError && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex gap-2.5 items-start text-xs text-[#DA291C] font-semibold animate-shake">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{uploadError}</p>
                </div>
              )}

              {/* Progress Bar Loader */}
              {uploadProgress !== null && (
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 space-y-2">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold text-slate-500 uppercase font-mono">{uploadStep}</span>
                    <span className="font-bold font-mono text-[#DA291C]">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-[#DA291C] h-full transition-all duration-300 rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {selectedFile && uploadProgress === null && (
                <div className="flex items-center gap-2 pt-1 animate-slide-up">
                  <button
                    type="submit"
                    className="flex-1 bg-[#DA291C] hover:bg-[#C21B10] text-white py-2 px-4 rounded-xl font-extrabold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Save Video to Hub
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setVideoTitle("");
                      setUploadError(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* SECTION 2: LIVE VIDEOS PLAYLIST */}
          <div className="space-y-3.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-450 flex items-center gap-2">
              <span>Cataloged Movie Guides ({activeVideoList.length})</span>
              <span className="bg-slate-200/50 text-slate-500 text-[9px] px-2 py-0.2 rounded-full font-mono lowercase">playable offline</span>
            </h3>

            {activeVideoList.length === 0 ? (
              <div className="text-center p-12 bg-white rounded-2xl border border-slate-200 space-y-2">
                <Video className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-500 font-medium">No videos added yet during this shift.</p>
              </div>
            ) : (
              <div className="space-y-3" id="videos-list-container">
                {activeVideoList.map((vid) => {
                  const sizeInMB = (vid.fileSize / (1024 * 1024)).toFixed(1);
                  const uploadDate = new Date(vid.timestamp).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                  });

                  // Check if local url blob exists
                  const hasUrl = !!localUrlMap[vid.id];

                  return (
                    <div 
                      key={vid.id}
                      className="bg-white border border-slate-200/80 rounded-2xl p-3.5 flex flex-col gap-3 shadow-2xs hover:border-slate-350 transition-colors"
                      id={`video-card-${vid.id}`}
                    >
                      <div className="flex gap-3 items-start justify-between">
                        
                        {/* Title and details column */}
                        <div className="flex gap-2.5 items-start min-w-0 flex-1">
                          <div className="w-9 h-9 bg-slate-105 border border-slate-200 rounded-xl flex items-center justify-center shrink-0 text-slate-500">
                            <Film className="w-4 w-4" />
                          </div>

                          <div className="min-w-0">
                            <h4 className="text-xs font-extrabold text-slate-800 tracking-tight leading-snug line-clamp-2" title={vid.title}>
                              {vid.title}
                            </h4>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[9.5px] text-slate-450 font-mono mt-1 font-medium">
                              <span className="text-slate-600 font-semibold">{vid.fileName}</span>
                              <span className="text-slate-300">•</span>
                              <span className="font-bold text-slate-600">{sizeInMB} MB</span>
                              <span className="text-slate-300">•</span>
                              <span>By {vid.uploadedBy}</span>
                            </div>
                            <p className="text-[8.5px] text-slate-400 font-mono mt-0.5">
                              {uploadDate}
                            </p>
                          </div>
                        </div>

                      </div>

                      {/* Control Operations Footer row */}
                      <div className="pt-2 border-t border-slate-105 flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              const url = localUrlMap[vid.id] || vid.url;
                              if (url) {
                                setPlayingVideo({ id: vid.id, title: vid.title, url });
                                setTimeout(() => {
                                  const el = document.getElementById("video-theater-player");
                                  el?.scrollIntoView({ behavior: "smooth", block: "start" });
                                }, 150);
                              } else {
                                alert("Downloading or streaming file payload... Please try playing again.");
                              }
                            }}
                            className="bg-[#DA291C]/5 hover:bg-[#DA291C]/15 text-[#DA291C] px-3.5 py-1.5 rounded-xl text-[10.5px] font-extrabold transition-all cursor-pointer flex items-center gap-1 shrink-0"
                            title="Play stream inside player"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" /> Play Video
                          </button>
                          
                          <button
                            onClick={() => triggerDownload(vid)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-[10.5px] font-extrabold transition-all cursor-pointer flex items-center gap-1 shrink-0"
                            title="Download video guide to device"
                          >
                            <Download className="w-3.5 h-3.5" /> Download
                          </button>
                        </div>

                        {/* Deletion action restricted */}
                        {!vid.id.startsWith("default_") && (
                          <button
                            onClick={() => triggerDeletion(vid.id, vid.title)}
                            className="text-slate-350 hover:text-[#DA291C] hover:bg-rose-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                            title="Remove video"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Footer secure warning */}
        <div className="bg-slate-100 border-t border-slate-200 px-5 py-3 text-[9px] text-slate-450 font-mono text-center shrink-0 uppercase tracking-wider flex items-center justify-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-slate-400" />
          <span>Local database sandbox isolation • PIN protected schema logs</span>
        </div>

      </div>

      {/* Security PIN verification portal */}
      <SecurityModal
        isOpen={secModalOpen}
        onCancel={() => {
          setSecModalOpen(false);
          setSecConfirmCallback(null);
        }}
        title="Restricted Shift Deletion"
        message={secModalMsg}
        requirePin={true}
        onConfirm={secConfirmCallback || (() => {})}
      />
    </div>
  );
}

// Plus component placeholder in case we need it
interface PlusProps {
  className?: string;
}
function Plus({ className }: PlusProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}
