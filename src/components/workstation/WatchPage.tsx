import React, { useState, useRef, useEffect } from "react";
import { VideoMetadata } from "../../types";
import { ThumbsUp, Download, Share2, MoreVertical, Maximize, Settings, Pause, Play, DownloadCloud, AlertCircle } from "lucide-react";

interface WatchPageProps {
  video: VideoMetadata;
  allVideos: VideoMetadata[];
  onPlayAnother: (v: VideoMetadata) => void;
  onClose: () => void;
  darkMode: boolean;
}

export default function WatchPage({ video, allVideos, onPlayAnother, onClose, darkMode }: WatchPageProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [quality, setQuality] = useState("Auto");

  const recommended = allVideos.filter(v => v.id !== video.id).slice(0, 10);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleDownload = () => {
    // Navigate to the backend endpoint which implements analytics 
    // and securely redirects to the signed original cloud storage payload.
    window.open(`/api/videos/${video.id}/download`, "_blank");
  };

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(e => console.log("Auto-play prevented", e));
      setIsPlaying(true);
    }
  }, [video.id]);

  return (
    <div className={`flex-1 overflow-y-auto flex flex-col lg:flex-row ${darkMode ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-900"}`}>
      {/* Main Video Area */}
      <div className="flex-1 lg:pl-8 lg:py-6 p-4 flex flex-col min-w-0">
        <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl group w-full max-w-[1200px] mx-auto">
          <video 
            ref={videoRef}
            src={video.url}
            className="w-full h-full object-contain"
            controls
            autoPlay
            playsInline
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
        </div>

        {/* Video Info */}
        <div className="w-full max-w-[1200px] mx-auto mt-4 space-y-4">
          <h1 className="text-xl sm:text-2xl font-bold">{video.title}</h1>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#DA291C] to-[#FFC72C] flex items-center justify-center shrink-0">
                <span className="text-white font-bold">{video.uploadedBy.charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <h3 className="font-bold text-sm leading-tight">{video.uploadedBy}</h3>
                <p className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
                  {video.uploadedRole} • {video.category || "General"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
              <button className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${darkMode ? "bg-slate-800 hover:bg-slate-700" : "bg-slate-200 hover:bg-slate-300"}`}>
                <ThumbsUp className="w-4 h-4" /> 
                Like
              </button>
              <button 
                onClick={handleDownload}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${darkMode ? "bg-slate-800 hover:bg-slate-700" : "bg-slate-200 hover:bg-slate-300"}`}
              >
                <Download className="w-4 h-4" /> Download
              </button>
              <button className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${darkMode ? "bg-slate-800 hover:bg-slate-700" : "bg-slate-200 hover:bg-slate-300"}`}>
                <Share2 className="w-4 h-4" /> Share
              </button>
            </div>
          </div>

          <div className={`mt-4 p-4 rounded-xl ${darkMode ? "bg-slate-900" : "bg-slate-200/50"} text-sm space-y-2`}>
            <div className="font-semibold">
              {video.views || 0} views • {new Date(video.timestamp).toLocaleDateString()}
            </div>
            <p className={`whitespace-pre-wrap ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
              {video.description || "No description provided for this operational guide."}
            </p>
          </div>
        </div>
      </div>

      {/* Recommended Sidebar */}
      <div className={`w-full lg:w-[400px] shrink-0 p-4 lg:py-6 lg:pr-8 flex flex-col gap-4 ${darkMode ? "bg-slate-950" : "bg-slate-50"}`}>
        <h3 className="font-bold text-lg px-2">Up Next</h3>
        <div className="flex flex-col gap-3">
          {recommended.map(vid => (
            <div 
              key={vid.id}
              onClick={() => onPlayAnother(vid)}
              className={`flex gap-2 p-2 rounded-xl cursor-pointer transition-colors ${darkMode ? "hover:bg-slate-900" : "hover:bg-slate-200"}`}
            >
              <div className="relative w-40 aspect-video bg-black rounded-lg overflow-hidden shrink-0">
                {vid.thumbnail ? (
                  <img src={vid.thumbnail} alt={vid.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-800">
                    <Play className="w-8 h-8 text-white/20" />
                  </div>
                )}
              </div>
              <div className="flex flex-col flex-1 min-w-0 py-1">
                <h4 className="font-bold text-sm leading-tight line-clamp-2" title={vid.title}>{vid.title}</h4>
                <p className={`text-xs mt-1 ${darkMode ? "text-slate-400" : "text-slate-600"}`}>{vid.uploadedBy}</p>
                <p className={`text-xs ${darkMode ? "text-slate-500" : "text-slate-500"}`}>{vid.views || 0} views</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
