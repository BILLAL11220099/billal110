import React, { useState, useRef, useEffect } from "react";
import Hls from "hls.js";
import { VideoMetadata } from "../../types";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Settings, 
  Maximize, 
  Minimize, 
  ChevronRight, 
  ChevronLeft,
  ThumbsUp, 
  Download, 
  Share2, 
  Clock, 
  Sliders,
  Check
} from "lucide-react";

interface WatchPageProps {
  video: VideoMetadata;
  allVideos: VideoMetadata[];
  onPlayAnother: (v: VideoMetadata) => void;
  onClose: () => void;
  darkMode: boolean;
}

export default function WatchPage({ video, allVideos, onPlayAnother, onClose, darkMode }: WatchPageProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  
  // HLS / Quality States
  const [qualities, setQualities] = useState<{ index: number; name: string }[]>([]);
  const [currentQualityIndex, setCurrentQualityIndex] = useState(-1);
  const [actualQualityName, setActualQualityName] = useState("Auto");
  const [hlsObj, setHlsObj] = useState<Hls | null>(null);

  // Settings Menu
  const [showSettings, setShowSettings] = useState(false);
  const [menuTab, setMenuTab] = useState<"main" | "quality" | "speed">("main");
  const [speed, setSpeed] = useState(1);

  const recommended = allVideos.filter(v => v.id !== video.id).slice(0, 10);

  // Increase views
  useEffect(() => {
    const incrementViews = async () => {
      try {
        const db = (await import("../../data/firebase")).db;
        const { doc, updateDoc, increment } = await import("firebase/firestore");
        await updateDoc(doc(db, "videos", video.id), {
          views: increment(1)
        });
      } catch (err) {
        console.warn("Failed to increment views:", err);
      }
    };
    incrementViews();
  }, [video.id]);

  // HLS and video configuration
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    let hls: Hls | null = null;
    setIsPlaying(false);
    setCurrentTime(0);
    setQualities([]);
    setActualQualityName("Auto");
    setCurrentQualityIndex(-1);

    const isHls = video.url?.endsWith(".m3u8") || video.url?.includes("/hls/");

    if (isHls) {
      if (Hls.isSupported()) {
        hls = new Hls({
          capLevelToPlayerSize: false,
          maxMaxBufferLength: 30,
        });
        setHlsObj(hls);
        hls.loadSource(video.url || "");
        hls.attachMedia(videoElement);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          const levels = hls!.levels.map((level, idx) => ({
            index: idx,
            name: level.height ? `${level.height}p` : `Stream ${idx}`,
          }));
          setQualities([{ index: -1, name: "Auto" }, ...levels]);
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
          const matchedLevel = hls!.levels[data.level];
          if (hls!.autoLevelEnabled) {
            setActualQualityName(matchedLevel ? `Auto (${matchedLevel.height}p)` : "Auto");
          } else {
            setActualQualityName(matchedLevel ? `${matchedLevel.height}p` : "Manual");
          }
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.warn("HLS network error, trying to recover...", data);
                hls!.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.warn("HLS media error, trying recovery...", data);
                hls!.recoverMediaError();
                break;
              default:
                console.error("Fatal HLS error, cannot recover", data);
                break;
            }
          }
        });
      } else if (videoElement.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari native support
        videoElement.src = video.url || "";
        setQualities([{ index: -1, name: "Native" }]);
        setActualQualityName("Native");
      }
    } else {
      // Standard progressive MP4 video
      videoElement.src = video.url || "";
      setQualities([{ index: -1, name: "Standard (MP4)" }]);
      setActualQualityName("Standard");
    }

    // Auto-play
    videoElement.play().catch(err => console.log("Auto-play blocked:", err));

    return () => {
      if (hls) {
        hls.destroy();
      }
      setHlsObj(null);
    };
  }, [video.url]);

  // Controls Visibility Timeout
  useEffect(() => {
    let timerId: any;
    const hideControls = () => {
      if (isPlaying) {
        setShowControls(false);
      }
    };
    
    const resetTimer = () => {
      setShowControls(true);
      clearTimeout(timerId);
      timerId = setTimeout(hideControls, 3000);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener("mousemove", resetTimer);
      container.addEventListener("click", resetTimer);
    }

    return () => {
      clearTimeout(timerId);
      if (container) {
        container.removeEventListener("mousemove", resetTimer);
        container.removeEventListener("click", resetTimer);
      }
    };
  }, [isPlaying]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(e => console.log(e));
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekVal = parseFloat(e.target.value);
    setCurrentTime(seekVal);
    if (videoRef.current) {
      videoRef.current.currentTime = seekVal;
    }
  };

  const skipTime = (amount: number) => {
    if (videoRef.current) {
      let targetTime = videoRef.current.currentTime + amount;
      if (targetTime < 0) targetTime = 0;
      if (targetTime > duration) targetTime = duration;
      videoRef.current.currentTime = targetTime;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const volVal = parseFloat(e.target.value);
    setVolume(volVal);
    setIsMuted(volVal === 0);
    if (videoRef.current) {
      videoRef.current.volume = volVal;
      videoRef.current.muted = volVal === 0;
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const nextMuted = !isMuted;
      setIsMuted(nextMuted);
      videoRef.current.muted = nextMuted;
      if (!nextMuted && volume === 0) {
        setVolume(0.5);
        videoRef.current.volume = 0.5;
      }
    }
  };

  const handleSpeedChange = (rate: number) => {
    setSpeed(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    setMenuTab("main");
  };

  const handleQualityChange = (idx: number) => {
    setCurrentQualityIndex(idx);
    if (hlsObj) {
      hlsObj.currentLevel = idx;
    }
    setMenuTab("main");
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => {
          // Fallback iOS/Safari
          if (videoRef.current && (videoRef.current as any).webkitEnterFullscreen) {
            (videoRef.current as any).webkitEnterFullscreen();
          }
        });
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  useEffect(() => {
    const updateFsState = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", updateFsState);
    return () => document.removeEventListener("fullscreenchange", updateFsState);
  }, []);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const handleDownload = async () => {
    try {
      const db = (await import("../../data/firebase")).db;
      const { doc, updateDoc, increment } = await import("firebase/firestore");
      await updateDoc(doc(db, "videos", video.id), {
        downloads: increment(1)
      });
    } catch (err) {
      console.warn("Failed to increment download counter", err);
    }
    const targetUrl = video.downloadUrl || video.url;
    if (targetUrl) {
      window.open(targetUrl, "_blank");
    }
  };

  return (
    <div className={`flex-1 overflow-y-auto flex flex-col lg:flex-row ${darkMode ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-900"}`}>
      {/* Main Video Section */}
      <div className="flex-1 lg:pl-8 lg:py-6 p-4 flex flex-col min-w-0">
        
        {/* Custom Video Player Container */}
        <div 
          ref={containerRef}
          id="custom-hls-player"
          className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl group w-full max-w-[1250px] mx-auto select-none"
        >
          <video
            ref={videoRef}
            className="w-full h-full object-contain cursor-pointer"
            playsInline
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onClick={togglePlay}
          />

          {/* Central Play/Pause Overlay Animated Feedback */}
          {!isPlaying && (
            <div 
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center bg-black/35 cursor-pointer hover:bg-black/45 transition-colors"
            >
              <div className="w-16 h-16 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-lg transform hover:scale-110 active:scale-95 transition-all duration-200">
                <Play className="w-8 h-8 fill-white ml-1" />
              </div>
            </div>
          )}

          {/* Double Tap Seek Feedback Triggers for Touch Screens */}
          <div className="absolute inset-y-0 left-0 w-1/4 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-1/4 pointer-events-none" />

          {/* Player controls overlay */}
          <div 
            className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 flex flex-col gap-3 transition-all duration-300 ${
              showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
            }`}
          >
            {/* Timeline scratch bar */}
            <div className="flex items-center gap-3 group/timeline">
              <span className="text-xs font-mono text-white/80">{formatTime(currentTime)}</span>
              <div className="relative flex-1 flex items-center">
                <input 
                  type="range"
                  min="0"
                  max={duration || 100}
                  step="0.1"
                  value={currentTime}
                  onChange={handleSeekChange}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-white/20 accent-red-600 focus:outline-none focus:ring-0 active:accent-red-500 transition-all"
                  style={{
                    background: `linear-gradient(to right, #dc2626 0%, #dc2626 ${((currentTime / (duration || 100)) * 100).toFixed(2)}%, rgba(255,255,255,0.2) ${((currentTime / (duration || 100)) * 100).toFixed(2)}%, rgba(255,255,255,0.2) 100%)`
                  }}
                  aria-label="Seek progress timeline"
                />
              </div>
              <span className="text-xs font-mono text-white/80">{formatTime(duration)}</span>
            </div>

            {/* Icons row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Play/Pause */}
                <button 
                  onClick={togglePlay}
                  className="text-white hover:text-red-500 hover:scale-110 active:scale-95 transition-all"
                  style={{ minWidth: "44px", minHeight: "44px" }}
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white" />}
                </button>

                {/* Back 10s */}
                <button 
                  onClick={() => skipTime(-10)} 
                  className="text-white/80 hover:text-white transition-all hidden sm:block"
                  style={{ minWidth: "44px", minHeight: "44px" }}
                  aria-label="Rewind 10 seconds"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>

                {/* Volume bar */}
                <div className="flex items-center gap-2 group/volume">
                  <button 
                    onClick={toggleMute}
                    className="text-white hover:scale-110 active:scale-95 transition-all"
                    style={{ minWidth: "44px", minHeight: "44px" }}
                    aria-label={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted || volume === 0 ? <VolumeX className="w-5 h-5 text-red-500" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                  <input 
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-0 sm:group-hover/volume:w-16 h-1 rounded bg-white/20 appearance-none accent-white cursor-pointer transition-all duration-300 focus:outline-none"
                    aria-label="Volume slider"
                  />
                </div>
              </div>

              {/* Right tools */}
              <div className="flex items-center gap-3">
                
                {/* Settings triggers */}
                <div className="relative">
                  <button 
                    onClick={() => {
                      setShowSettings(!showSettings);
                      setMenuTab("main");
                    }} 
                    className={`text-white transition-all hover:scale-115 ${showSettings ? "text-red-500 rotate-45" : "hover:text-white"}`}
                    style={{ minWidth: "44px", minHeight: "44px" }}
                    aria-label="Playback options"
                  >
                    <Settings className="w-5 h-5" />
                  </button>

                  {/* Floating settings menu inside video canvas */}
                  {showSettings && (
                    <div className="absolute bottom-12 right-0 bg-slate-950/95 backdrop-blur-md rounded-xl p-3 shadow-xl w-64 text-sm flex flex-col border border-white/10 text-white select-none z-50">
                      
                      {/* Main Settings Panel */}
                      {menuTab === "main" && (
                        <div className="space-y-1">
                          <div className="text-xs px-2 py-1 text-white/50 border-b border-white/5 font-semibold uppercase tracking-wider">Settings</div>
                          
                          <button 
                            onClick={() => setMenuTab("quality")}
                            className="w-full flex items-center justify-between px-2 py-2 hover:bg-white/10 rounded-lg transition-colors text-left"
                          >
                            <span className="flex items-center gap-2"><Sliders className="w-4 h-4 text-white/60" /> Resolution</span>
                            <span className="text-xs text-red-400 font-medium flex items-center gap-1">{actualQualityName} <ChevronRight className="w-3.5 h-3.5" /></span>
                          </button>

                          <button 
                            onClick={() => setMenuTab("speed")}
                            className="w-full flex items-center justify-between px-2 py-2 hover:bg-white/10 rounded-lg transition-colors text-left"
                          >
                            <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-white/60" /> Playback Speed</span>
                            <span className="text-xs text-red-400 font-medium flex items-center gap-1">{speed === 1 ? "Normal" : `${speed}x`} <ChevronRight className="w-3.5 h-3.5" /></span>
                          </button>
                        </div>
                      )}

                      {/* Quality selection */}
                      {menuTab === "quality" && (
                        <div className="space-y-1">
                          <button 
                            onClick={() => setMenuTab("main")}
                            className="flex items-center gap-1 px-1 py-1 hover:text-red-400 text-xs text-white/70 font-semibold mb-1"
                          >
                            <ChevronLeft className="w-4 h-4" /> Go Back
                          </button>
                          <div className="text-xs px-2 text-white/40 pb-1 border-b border-white/5 uppercase tracking-wider">Select quality</div>
                          <div className="max-h-48 overflow-y-auto mt-1 space-y-0.5 scrollbar-thin">
                            {qualities.length > 0 ? (
                              qualities.map((item) => (
                                <button 
                                  key={item.index}
                                  onClick={() => handleQualityChange(item.index)}
                                  className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-white/10 rounded-md text-left transition-colors"
                                >
                                  <span>{item.name}</span>
                                  {currentQualityIndex === item.index && <Check className="w-4 h-4 text-red-500" />}
                                </button>
                              ))
                            ) : (
                              <div className="px-2 py-2 text-xs text-white/50">Auto resolving streams...</div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Speed selection */}
                      {menuTab === "speed" && (
                        <div className="space-y-1">
                          <button 
                            onClick={() => setMenuTab("main")}
                            className="flex items-center gap-1 px-1 py-1 hover:text-red-400 text-xs text-white/70 font-semibold mb-1"
                          >
                            <ChevronLeft className="w-4 h-4" /> Go Back
                          </button>
                          <div className="text-xs px-2 text-white/40 pb-1 border-b border-white/5 uppercase tracking-wider">Playback rate</div>
                          <div className="mt-1 space-y-0.5">
                            {[0.5, 1, 1.25, 1.5, 2].map((rate) => (
                              <button 
                                key={rate}
                                onClick={() => handleSpeedChange(rate)}
                                className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-white/10 rounded-md text-left transition-colors"
                              >
                                <span>{rate === 1 ? "Normal (1x)" : `${rate}x`}</span>
                                {speed === rate && <Check className="w-4 h-4 text-red-500" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  )}
                </div>

                {/* Fullscreen */}
                <button 
                  onClick={toggleFullscreen}
                  className="text-white hover:text-red-500 hover:scale-115 active:scale-95 transition-all"
                  style={{ minWidth: "44px", minHeight: "44px" }}
                  aria-label="Maximize screen"
                >
                  {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Video Info Detail Blocks */}
        <div className="w-full max-w-[1250px] mx-auto mt-5 space-y-4">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{video.title}</h1>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center shadow-md shrink-0">
                <span className="text-white font-bold text-base">{video.uploadedBy.charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <h3 className="font-bold text-sm leading-tight">{video.uploadedBy}</h3>
                <p className={`text-xs mt-0.5 ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
                  {video.uploadedRole} • {video.category || "General"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 hide-scrollbar scrollbar-none">
              <button className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold shadow-sm transition-colors cursor-pointer ${darkMode ? "bg-slate-800 hover:bg-slate-700" : "bg-slate-200 hover:bg-slate-300"}`}>
                <ThumbsUp className="w-4 h-4" /> 
                Recommend
              </button>
              <button 
                onClick={handleDownload}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold shadow-sm transition-colors cursor-pointer ${darkMode ? "bg-slate-800 hover:bg-slate-700" : "bg-slate-200 hover:bg-slate-300"}`}
              >
                <Download className="w-4 h-4" /> Download
              </button>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  alert("Link copied successfully to your clipboard!");
                }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold shadow-sm transition-colors cursor-pointer ${darkMode ? "bg-slate-800 hover:bg-slate-700" : "bg-slate-200 hover:bg-slate-300"}`}
              >
                <Share2 className="w-4 h-4" /> Copy Link
              </button>
            </div>
          </div>

          <div className={`mt-4 p-4 rounded-xl ${darkMode ? "bg-slate-900/80 border border-white/5" : "bg-slate-200/50 border border-slate-300/30"} text-sm space-y-2`}>
            <div className="font-bold flex items-center gap-2">
              <span className={darkMode ? "text-slate-100" : "text-slate-800"}>{video.views || 0} views</span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-400">{new Date(video.timestamp).toLocaleDateString()}</span>
            </div>
            <p className={`whitespace-pre-wrap leading-relaxed ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
              {video.description || "No description provided for this operational guide."}
            </p>
          </div>
        </div>
      </div>

      {/* Recommended Up Next Sidebar Playlist */}
      <div className={`w-full lg:w-[420px] shrink-0 p-4 lg:py-6 lg:pr-8 flex flex-col gap-4 border-l ${darkMode ? "bg-slate-950/40 border-white/5" : "bg-slate-50 border-slate-200"}`}>
        <h3 className="font-bold text-lg px-2 tracking-tight">Up Next</h3>
        <div className="flex flex-col gap-3">
          {recommended.length > 0 ? (
            recommended.map(vid => (
              <div 
                key={vid.id}
                onClick={() => onPlayAnother(vid)}
                className={`flex gap-2.5 p-2 rounded-xl cursor-pointer transition-colors border ${darkMode ? "hover:bg-slate-900 bg-slate-900/20 border-transparent hover:border-white/5" : "hover:bg-slate-200/75 bg-transparent border-transparent"}`}
              >
                <div className="relative w-36 aspect-video bg-black rounded-lg overflow-hidden shrink-0 shadow-sm border border-black/10">
                  {vid.thumbnail ? (
                    <img src={vid.thumbnail} alt={vid.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-800">
                      <Play className="w-6 h-6 text-white/30" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col flex-1 min-w-0 py-0.5 justify-between">
                  <h4 className="font-bold text-xs sm:text-sm leading-tight text-slate-800 dark:text-slate-150 line-clamp-2" title={vid.title}>{vid.title}</h4>
                  <div>
                    <p className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-600"} font-medium`}>{vid.uploadedBy}</p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5 uppercase">{vid.views || 0} views</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-xs text-slate-550 border border-dashed rounded-xl border-slate-300/30">
              No other training guides are available yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
