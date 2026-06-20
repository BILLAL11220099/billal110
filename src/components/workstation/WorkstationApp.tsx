import React, { useState } from "react";
import { VideoMetadata, UserSession } from "../../types";
import { X, Search, Menu, Home, Compass, Plus, Upload, Moon, Sun, MonitorPlay, Clapperboard, MonitorUp } from "lucide-react";
import VideoFeed from "./VideoFeed";
import WatchPage from "./WatchPage";
import UploadManager from "./UploadManager";

interface WorkstationAppProps {
  isOpen: boolean;
  onClose: () => void;
  videos: VideoMetadata[];
  currentSession: UserSession;
  onSaveVideos: (videosList: VideoMetadata[]) => void;
}

const CATEGORIES = [
  "All", "Opening Shift", "Closing Shift", "Kitchen", "Service", "Drive Thru", 
  "Maintenance", "Food Safety", "Crew Training", "Manager Training", "General"
];

export default function WorkstationApp({
  isOpen,
  onClose,
  videos,
  currentSession,
  onSaveVideos
}: WorkstationAppProps) {
  const [activeVideo, setActiveVideo] = useState<VideoMetadata | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [showUpload, setShowUpload] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (!isOpen) return null;

  const handleSaveVideo = (v: VideoMetadata) => {
    onSaveVideos([v, ...videos]);
  };

  const isManagerOrAdmin = currentSession.role === "Business Manager" || currentSession.role === "Trainer" || currentSession.role === "Kitchen Leader";

  return (
    <div className={`fixed inset-0 z-50 flex flex-col font-sans transition-colors ${darkMode ? "bg-slate-950 text-white" : "bg-white text-slate-900"}`}>
      
      {/* Header */}
      <header className={`h-16 shrink-0 flex items-center justify-between px-4 sm:px-6 border-b transition-colors ${darkMode ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-white"}`}>
        <div className="flex items-center gap-4">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className={`p-2 rounded-full cursor-pointer transition-colors ${darkMode ? "hover:bg-slate-800" : "hover:bg-slate-100"}`}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveVideo(null)}>
            <div className="w-8 h-8 bg-[#DA291C] rounded-lg flex items-center justify-center">
              <MonitorPlay className="w-5 h-5 text-white" />
            </div>
            <span className="font-extrabold text-lg tracking-tight hidden sm:block">ShiftTube</span>
          </div>
        </div>

        <div className="flex-1 max-w-2xl px-4 flex justify-center">
          <div className="w-full max-w-xl relative flex items-center">
            <input 
              type="text" 
              placeholder="Search training videos..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={`w-full rounded-full pl-4 pr-12 py-2.5 outline-none border transition-colors ${darkMode ? "bg-slate-900 border-slate-800 focus:border-slate-600 text-white" : "bg-slate-50 border-slate-200 focus:border-[#DA291C] text-slate-900"}`}
            />
            <button className={`absolute right-0 top-0 bottom-0 px-4 rounded-r-full flex items-center justify-center transition-colors ${darkMode ? "bg-slate-800 hover:bg-slate-700 text-slate-300" : "bg-slate-100 hover:bg-slate-200 text-slate-500 border-l border-slate-200"}`}>
              <Search className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {isManagerOrAdmin && (
            <button onClick={() => setShowUpload(true)} className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all ${darkMode ? "bg-slate-800 hover:bg-slate-700" : "bg-slate-100 hover:bg-slate-200"}`}>
              <MonitorUp className="w-4 h-4" /> <span className="hidden sm:inline">Upload</span>
            </button>
          )}
          <button onClick={() => setDarkMode(!darkMode)} className={`p-2 rounded-full transition-colors ${darkMode ? "hover:bg-slate-800 text-slate-300" : "hover:bg-slate-100 text-slate-500"}`}>
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button onClick={onClose} className={`p-2 rounded-full transition-colors ${darkMode ? "hover:bg-red-500/20 text-red-500" : "hover:bg-red-50 text-red-500"}`}>
            <X className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex">
        {/* Sidebar */}
        {sidebarOpen && !activeVideo && (
          <aside className={`w-64 shrink-0 overflow-y-auto py-4 border-r transition-colors ${darkMode ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"} flex flex-col gap-6 hidden md:flex`}>
            <div className="px-3 space-y-1">
              <div 
                onClick={() => {setActiveCategory("All"); setActiveVideo(null);}} 
                className={`flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer font-medium text-sm transition-colors ${activeCategory === "All" ? (darkMode ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-900") : (darkMode ? "hover:bg-slate-900 text-slate-400" : "hover:bg-slate-50 text-slate-700")}`}
              >
                <Home className="w-5 h-5" /> Home
              </div>
              <div className={`flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer font-medium text-sm transition-colors ${darkMode ? "hover:bg-slate-900 text-slate-400" : "hover:bg-slate-50 text-slate-700"}`}>
                <Compass className="w-5 h-5" /> Explore
              </div>
              <div className={`flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer font-medium text-sm transition-colors ${darkMode ? "hover:bg-slate-900 text-slate-400" : "hover:bg-slate-50 text-slate-700"}`}>
                <Clapperboard className="w-5 h-5" /> Subscriptions
              </div>
            </div>

            <hr className={`border-t mx-6 ${darkMode ? "border-slate-800" : "border-slate-200"}`}/>
            
            <div className="px-3">
              <h3 className={`px-4 text-sm font-bold uppercase tracking-wider mb-2 ${darkMode ? "text-slate-500" : "text-slate-400"}`}>Categories</h3>
              <div className="space-y-1">
                {CATEGORIES.filter(c => c !== "All").map(cat => (
                  <div 
                    key={cat}
                    onClick={() => {setActiveCategory(cat); setActiveVideo(null);}} 
                    className={`px-4 py-2 rounded-xl cursor-pointer text-sm transition-colors ${activeCategory === cat ? (darkMode ? "bg-slate-800 text-white font-bold" : "bg-slate-100 text-slate-900 font-bold") : (darkMode ? "hover:bg-slate-900 text-slate-400" : "hover:bg-slate-50 text-slate-600")}`}
                  >
                    {cat}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        )}

        {/* Content routing */}
        {activeVideo ? (
          <WatchPage 
            video={activeVideo} 
            allVideos={videos} 
            onPlayAnother={setActiveVideo} 
            onClose={() => setActiveVideo(null)}
            darkMode={darkMode}
          />
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Horizontal Categories Filter for Mobile / Dense View */}
            <div className={`px-6 py-4 flex gap-3 overflow-x-auto shrink-0 border-b hide-scrollbar transition-colors ${darkMode ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-white"}`}>
               {CATEGORIES.map(cat => (
                 <button
                   key={cat}
                   onClick={() => setActiveCategory(cat)}
                   className={`px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeCategory === cat ? (darkMode ? "bg-white text-black" : "bg-slate-900 text-white") : (darkMode ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200")}`}
                 >
                   {cat}
                 </button>
               ))}
            </div>
            
            <VideoFeed 
              videos={videos} 
              onPlayVideo={(v) => setActiveVideo(v)} 
              searchQuery={searchQuery}
              activeCategory={activeCategory}
              darkMode={darkMode}
            />
          </div>
        )}
      </div>

      {showUpload && (
        <UploadManager 
          onClose={() => setShowUpload(false)} 
          currentSession={currentSession}
          onSaveVideo={handleSaveVideo}
          darkMode={darkMode}
        />
      )}
    </div>
  );
}
