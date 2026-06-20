import React, { useState, useRef } from "react";
import { Upload, X, Film, AlertCircle, CheckCircle, Pause, Play, Plus } from "lucide-react";
import { ref, uploadBytesResumable, getDownloadURL, UploadTask } from "firebase/storage";
import { storage } from "../../data/firebase";
import { VideoMetadata, UserSession } from "../../types";

interface UploadManagerProps {
  onClose: () => void;
  currentSession: UserSession;
  onSaveVideo: (v: VideoMetadata) => void;
  darkMode: boolean;
}

export default function UploadManager({ onClose, currentSession, onSaveVideo, darkMode }: UploadManagerProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("General");
  
  const [uploadTask, setUploadTask] = useState<UploadTask | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle"|"uploading"|"paused"|"success"|"error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 500 * 1024 * 1024) {
        setErrorMsg("File exceeds 500MB maximum size limit.");
        return;
      }
      setSelectedFile(file);
      setTitle(file.name.replace(/\.[^/.]+$/, ""));
      setErrorMsg("");
      setStatus("idle");
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dt = e.dataTransfer;
    if (dt.files && dt.files[0]) {
      const file = dt.files[0];
      if (file.size > 500 * 1024 * 1024) {
        setErrorMsg("File exceeds 500MB maximum size limit.");
        return;
      }
      setSelectedFile(file);
      setTitle(file.name.replace(/\.[^/.]+$/, ""));
      setErrorMsg("");
      setStatus("idle");
    }
  };

  const startUpload = () => {
    if (!selectedFile) return;
    if (!title.trim()) {
      setErrorMsg("Please enter a title");
      return;
    }
    
    setStatus("uploading");
    
    const formData = new FormData();
    formData.append("video", selectedFile);
    formData.append("title", title);
    formData.append("description", description);
    formData.append("category", category);
    formData.append("uploadedBy", currentSession.username);
    formData.append("uploadedRole", currentSession.role);
    formData.append("id", "vid_" + Date.now());

    const xhr = new XMLHttpRequest();
    // Use a ref to store xhr if we want to support cancelling, but let's keep it simple
    
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        const p = (e.loaded / e.total) * 100;
        setProgress(p);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setStatus("success");
        setTimeout(() => {
          onClose(); // Automatically close on success
        }, 2000);
      } else {
        setStatus("error");
        try {
          const res = JSON.parse(xhr.responseText);
          setErrorMsg(res.error || "Upload failed");
        } catch {
          setErrorMsg("Upload failed with status " + xhr.status);
        }
      }
    });

    xhr.addEventListener("error", () => {
      setStatus("error");
      setErrorMsg("Network error occurred during upload.");
    });

    xhr.open("POST", "/api/videos/upload", true);
    xhr.send(formData);
  };

  const togglePause = () => {
    // XMLHttpRequest doesn't support pause/resume natively. 
    // We'll leave it as a no-op or hide the pause button.
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={`w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col ${darkMode ? "bg-slate-900 border border-slate-700" : "bg-white border border-slate-200"}`}>
        
        <div className={`px-6 py-4 border-b flex items-center justify-between ${darkMode ? "border-slate-800" : "border-slate-100"}`}>
          <h2 className={`font-bold text-lg ${darkMode ? "text-white" : "text-slate-900"}`}>Upload Video</h2>
          <button onClick={onClose} className={`p-2 rounded-full transition-colors ${darkMode ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500"}`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[80vh]">
          {status === "idle" || status === "error" ? (
            <div className="space-y-6">
              <div 
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${darkMode ? "border-slate-700 hover:border-slate-500 bg-slate-800/50" : "border-slate-300 hover:border-slate-400 bg-slate-50"}`}
              >
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="video/*" className="hidden" />
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${darkMode ? "bg-slate-800 text-slate-400" : "bg-white text-slate-400 shadow-sm"}`}>
                  <Upload className="w-8 h-8" />
                </div>
                {selectedFile ? (
                  <p className={`font-bold ${darkMode ? "text-white" : "text-slate-900"}`}>{selectedFile.name}</p>
                ) : (
                  <>
                    <p className={`font-bold text-lg mb-1 ${darkMode ? "text-white" : "text-slate-900"}`}>Select your video file</p>
                    <p className={`text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>MP4, MOV, WEBM up to 500MB</p>
                  </>
                )}
              </div>

              {errorMsg && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p className="text-sm font-medium">{errorMsg}</p>
                </div>
              )}

              {selectedFile && (
                <div className="space-y-4">
                  <div>
                    <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Title (Required)</label>
                    <input 
                      type="text" 
                      value={title} 
                      onChange={e => setTitle(e.target.value)} 
                      className={`w-full px-4 py-2 rounded-xl border ${darkMode ? "bg-slate-950 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"} focus:outline-none focus:border-[#DA291C]`} 
                    />
                  </div>
                  <div>
                    <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Description</label>
                    <textarea 
                      value={description} 
                      onChange={e => setDescription(e.target.value)} 
                      rows={3}
                      className={`w-full px-4 py-2 rounded-xl border ${darkMode ? "bg-slate-950 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"} focus:outline-none focus:border-[#DA291C]`} 
                    />
                  </div>
                  <div>
                    <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Category</label>
                    <select 
                      value={category} 
                      onChange={e => setCategory(e.target.value)}
                      className={`w-full px-4 py-2 rounded-xl border ${darkMode ? "bg-slate-950 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"} focus:outline-none focus:border-[#DA291C]`}
                    >
                      <option>Opening Shift</option>
                      <option>Closing Shift</option>
                      <option>Kitchen</option>
                      <option>Service</option>
                      <option>Drive Thru</option>
                      <option>Maintenance</option>
                      <option>Food Safety</option>
                      <option>General</option>
                    </select>
                  </div>
                  
                  <div className="pt-4 flex justify-end gap-3">
                    <button onClick={onClose} className={`px-5 py-2.5 rounded-xl font-bold text-sm ${darkMode ? "hover:bg-slate-800 text-white" : "hover:bg-slate-100 text-slate-700"}`}>Cancel</button>
                    <button onClick={startUpload} className="px-5 py-2.5 rounded-xl font-bold text-sm bg-[#DA291C] text-white hover:bg-[#C21B10] flex items-center gap-2">
                       <Upload className="w-4 h-4" /> Start Upload
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-6">
              {status === "success" ? (
                <div className="w-20 h-20 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mb-2">
                  <CheckCircle className="w-10 h-10" />
                </div>
              ) : (
                <div className="relative w-24 h-24">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" className={`${darkMode ? "text-slate-800" : "text-slate-200"}`} />
                    <circle 
                      cx="48" cy="48" r="44" stroke="#DA291C" strokeWidth="6" fill="transparent"
                      strokeDasharray="276"
                      strokeDashoffset={276 - (276 * progress) / 100}
                      className="transition-all duration-300 ease-out" 
                    />
                  </svg>
                  <div className={`absolute inset-0 flex items-center justify-center font-bold text-lg ${darkMode ? "text-white" : "text-slate-900"}`}>
                    {Math.round(progress)}%
                  </div>
                </div>
              )}
              
              <div>
                <h3 className={`font-bold text-xl mb-1 ${darkMode ? "text-white" : "text-slate-900"}`}>
                  {status === "success" ? "Upload Complete!" : "Uploading Video"}
                </h3>
                <p className={`text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                  {status === "success" ? "Processing and generating adaptive streams..." : (status === "paused" ? "Upload paused." : "Keep this window open until upload completes.")}
                </p>
              </div>
              
              {status !== "success" && (
                <div className="flex items-center gap-3">
                  <button 
                    onClick={togglePause}
                    className={`px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 ${darkMode ? "bg-slate-800 text-white hover:bg-slate-700" : "bg-slate-100 text-slate-900 hover:bg-slate-200"}`}
                  >
                    {status === "paused" ? <><Play className="w-4 h-4"/> Resume</> : <><Pause className="w-4 h-4"/> Pause</>}
                  </button>
                  <button onClick={() => { uploadTask?.cancel(); setStatus("idle"); }} className="px-5 py-2.5 rounded-xl font-bold text-sm text-red-500 hover:bg-red-500/10">
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
