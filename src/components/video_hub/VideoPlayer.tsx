import React, { useRef, useState, useEffect } from "react";
import { AnimatePresence } from "motion/react";
import { 
  Play, Pause, Volume2, VolumeX, Maximize2, Minimize2, 
  Settings, RotateCcw, SkipForward, X 
} from "lucide-react";

interface VideoPlayerProps {
  videoUrl: string;
  title: string;
  onClose: () => void;
}

export default function VideoPlayer({ videoUrl, title, onClose }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  // Auto-hide controls after inactivity
  useEffect(() => {
    let timeoutId: any;
    if (isPlaying && showControls) {
      timeoutId = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
    return () => clearTimeout(timeoutId);
  }, [isPlaying, showControls]);

  const handleContainerMouseMove = () => {
    setShowControls(true);
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.warn("Autoplay / continuous playback blocked:", err);
      });
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
    if (videoRef.current) {
      const time = parseFloat(e.target.value);
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) {
      const vol = parseFloat(e.target.value);
      videoRef.current.volume = vol;
      setVolume(vol);
      setIsMuted(vol === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const targetMute = !isMuted;
      videoRef.current.muted = targetMute;
      setIsMuted(targetMute);
    }
  };

  const handleSpeedSelect = (speed: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
      setPlaybackSpeed(speed);
      setShowSpeedMenu(false);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      const req = 
        containerRef.current.requestFullscreen || 
        (containerRef.current as any).webkitRequestFullscreen || 
        (containerRef.current as any).mozRequestFullScreen || 
        (containerRef.current as any).msRequestFullscreen;
      
      if (req) {
        req.call(containerRef.current)
          .then(() => setIsFullscreen(true))
          .catch(err => console.error(err));
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false));
      }
    }
  };

  // Monitor fullscreen change events (e.g. esc key exit)
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("webkitfullscreenchange", handleFsChange);
    };
  }, []);

  const formatTime = (timeInSecs: number) => {
    if (isNaN(timeInSecs)) return "00:00";
    const hrs = Math.floor(timeInSecs / 3600);
    const mins = Math.floor((timeInSecs % 3600) / 60);
    const secs = Math.floor(timeInSecs % 60);

    const pad = (num: number) => num.toString().padStart(2, "0");

    if (hrs > 0) {
      return `${hrs}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  };

  const skipRelative = (sec: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + sec));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col justify-between select-none" ref={containerRef} onMouseMove={handleContainerMouseMove}>
      
      {/* Header Bar */}
      <div className={`p-4 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between z-10 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <div>
          <span className="text-xs font-mono font-bold text-amber-400 tracking-wider uppercase mb-1 block">McDonald's Training Station</span>
          <h2 className="text-lg md:text-xl font-bold text-white tracking-tight leading-tight">{title}</h2>
        </div>
        
        <button 
          onClick={onClose}
          className="bg-white/10 hover:bg-white/20 active:scale-95 text-white/80 hover:text-white p-2.5 rounded-full transition-all cursor-pointer"
          title="Exit Player"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Playback Area */}
      <div className="flex-1 flex items-center justify-center relative cursor-pointer" onClick={togglePlay}>
        <video
          ref={videoRef}
          src={videoUrl}
          className="max-h-full max-w-full object-contain"
          playsInline
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
        />

        {/* Big Play/Pause Center Indicator */}
        <AnimatePresence>
          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="w-20 h-20 bg-white/10 hover:bg-white/20 border border-white/25 rounded-full flex items-center justify-center text-white backdrop-blur-md shadow-2xl transition hover:scale-110 active:scale-95 animate-pulse">
                <Play className="w-9 h-9 fill-current ml-1" />
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Control Panel Area */}
      <div className={`bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 md:p-6 transition-opacity duration-300 z-10 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        
        {/* Seek Bar / Slider */}
        <div className="group relative flex items-center mb-4">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeekChange}
            className="w-full h-1.5 bg-white/25 rounded-lg appearance-none cursor-pointer outline-none transition-all duration-150 group-hover:h-2 accent-[#DA291C] text-[#DA291C]"
            style={{
              background: `linear-gradient(to right, #DA291C 0%, #DA291C ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.25) ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.25) 100%)`
            }}
          />
        </div>

        {/* Action Button Row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          
          <div className="flex items-center gap-2.5">
            {/* Play / Pause */}
            <button 
              onClick={(e) => { e.stopPropagation(); togglePlay(); }}
              className="p-2 text-white/90 hover:text-white rounded-lg hover:bg-white/10 transition-all cursor-pointer"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
            </button>

            {/* Back 10s */}
            <button 
              onClick={(e) => { e.stopPropagation(); skipRelative(-10); }}
              className="p-2 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-all cursor-pointer"
              title="Rewind 10s"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Forward 10s */}
            <button 
              onClick={(e) => { e.stopPropagation(); skipRelative(10); }}
              className="p-2 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-all cursor-pointer"
              title="Forward 10s"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            {/* Volume Icon + Slider */}
            <div className="flex items-center gap-1.5 group/vol ml-2">
              <button 
                onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                className="p-2 text-white/95 hover:text-white rounded-lg hover:bg-white/10 transition"
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => { e.stopPropagation(); handleVolumeChange(e); }}
                className="w-0 overflow-hidden group-hover/vol:w-16 md:group-hover/vol:w-20 lg:group-hover/vol:w-24 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer outline-none transition-all duration-300 accent-white"
              />
            </div>

            {/* Clock / Speed Timing Display */}
            <span className="text-xs text-white/80 font-mono select-none ml-2">
              {formatTime(currentTime)} <span className="opacity-40">/</span> {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-4 relative">
            
            {/* Speed Control */}
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setShowSpeedMenu(!showSpeedMenu); }}
                className="flex items-center gap-1 text-xs text-white/90 hover:text-white px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 transition-all text-center tracking-wide font-medium cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>{playbackSpeed}x</span>
              </button>

              {showSpeedMenu && (
                <div 
                  className="absolute bottom-11 right-0 bg-[#1A1A1A] border border-white/10 rounded-xl py-1 w-24 shadow-2xl z-20 flex flex-col overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  {[0.5, 1, 1.25, 1.5, 2].map((sp) => (
                    <button
                      key={sp}
                      onClick={() => handleSpeedSelect(sp)}
                      className={`text-left text-xs px-3 py-2 text-white/80 hover:bg-[#DA291C] hover:text-white font-medium transition ${
                        playbackSpeed === sp ? "bg-[#DA291C]/35 text-white" : ""
                      }`}
                    >
                      {sp}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fullscreen Toggle */}
            <button 
              onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
              className="p-2 text-white/90 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
              title="Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
          </div>

        </div>

      </div>

    </div>
  );
}
