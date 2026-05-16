"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";

interface VideoWallpaperProps {
  src: string;
  poster?: string;
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
}

/**
 * 视频壁纸播放组件
 * - 支持播放/暂停控制
 * - 静音/取消静音
 * - 自动循环播放
 * - 海报帧预览
 */
export default function VideoWallpaper({
  src,
  poster,
  className = "",
  autoPlay = true,
  muted = true,
  loop = true,
}: VideoWallpaperProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(muted);
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isPlaying]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPlaying(!isPlaying);
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted(!isMuted);
  };

  return (
    <div
      className={`relative group ${className}`}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay={autoPlay}
        muted={isMuted}
        loop={loop}
        playsInline
        className="w-full h-full object-cover"
      />

      {/* 播放控制覆盖层 */}
      <div
        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
          showControls || !isPlaying ? "opacity-100" : "opacity-0"
        }`}
      >
        {!isPlaying && (
          <button
            onClick={togglePlay}
            className="w-14 h-14 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center transition-colors"
          >
            <Play className="w-7 h-7 text-white ml-1" />
          </button>
        )}
      </div>

      {/* 底部控制栏 */}
      <div
        className={`absolute bottom-0 left-0 right-0 p-2 flex items-center gap-2 bg-gradient-to-t from-black/50 to-transparent transition-opacity duration-200 ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        <button onClick={togglePlay} className="text-white hover:text-white/80">
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button onClick={toggleMute} className="text-white hover:text-white/80">
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <span className="text-xs text-white/70 ml-auto">动态壁纸</span>
      </div>
    </div>
  );
}