import React from "react";
import { VideoMetadata, UserSession } from "../../types";
import { Play, Clock, User, Filter, Image as ImageIcon } from "lucide-react";
import { motion } from "motion/react";

interface VideoFeedProps {
  videos: VideoMetadata[];
  onPlayVideo: (video: VideoMetadata) => void;
  searchQuery: string;
  activeCategory: string;
  darkMode: boolean;
}

export default function VideoFeed({ videos, onPlayVideo, searchQuery, activeCategory, darkMode }: VideoFeedProps) {
  const filtered = videos.filter(v => {
    const matchesSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase()) || (v.description?.toLowerCase() || "").includes(searchQuery.toLowerCase());
    const matchesCat = activeCategory === "All" || v.category === activeCategory;
    return matchesSearch && matchesCat;
  });

  if (filtered.length === 0) {
    return (
      <div className={`flex-1 flex flex-col items-center justify-center p-12 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
        <Filter className="w-16 h-16 opacity-20 mb-4" />
        <h2 className="text-xl font-bold mb-2">No videos found</h2>
        <p>Try adjusting your search or category filter.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 gap-y-10">
        {filtered.map(vid => (
          <motion.div 
            whileHover={{ scale: 1.02 }}
            key={vid.id} 
            onClick={() => onPlayVideo(vid)}
            className="cursor-pointer group flex flex-col cursor-pointer"
          >
            <div className={`relative aspect-video rounded-xl overflow-hidden mb-3 ${darkMode ? "bg-slate-800 border-slate-700" : "bg-slate-200 border-slate-200"} border shadow-sm`}>
              {vid.thumbnail ? (
                <img src={vid.thumbnail} alt={vid.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-900 group-hover:scale-105 transition-transform duration-300">
                  <Play className="w-12 h-12 text-white/20" />
                </div>
              )}
              <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded">
                {(vid as any).status === "Converting" ? `Processing ${(vid as any).progress || 0}%` : "Video"}
              </div>
            </div>
            <div className="flex gap-3 px-1">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#DA291C] to-[#FFC72C] flex items-center justify-center shrink-0 shadow-sm">
                <span className="text-white text-xs font-bold">{vid.uploadedBy.charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex flex-col overflow-hidden">
                <h3 className={`font-semibold text-sm leading-tight mb-1 line-clamp-2 ${darkMode ? "text-white" : "text-slate-900"}`} title={vid.title}>
                  {vid.title}
                </h3>
                <span className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"} truncate`}>
                  {vid.uploadedBy} • {vid.category || "General"}
                </span>
                <span className={`text-[11px] ${darkMode ? "text-slate-500" : "text-slate-400"}`}>
                  {vid.views || 0} views • {new Date(vid.timestamp).toLocaleDateString()}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
