"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// 设备类型定义
export type DeviceType = "iphone" | "android" | "ipad" | "desktop" | "ultrawide";

export interface DeviceInfo {
  id: DeviceType;
  name: string;
  width: number;
  height: number;
  label: string;
}

export const DEVICES: DeviceInfo[] = [
  { id: "iphone", name: "iPhone", width: 375, height: 812, label: "375×812" },
  { id: "android", name: "Android", width: 360, height: 800, label: "360×800" },
  { id: "ipad", name: "iPad", width: 768, height: 1024, label: "768×1024" },
  { id: "desktop", name: "Desktop", width: 1920, height: 1080, label: "1920×1080" },
  { id: "ultrawide", name: "Ultrawide", width: 3440, height: 1440, label: "3440×1440" },
];

interface DeviceMockupProps {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  deviceType: DeviceType;
  onPositionChange?: (x: number, y: number) => void;
}

export default function DeviceMockup({
  imageUrl,
  imageWidth,
  imageHeight,
  deviceType,
  onPositionChange,
}: DeviceMockupProps) {
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  // 切换设备时重置位置和缩放
  useEffect(() => {
    setPosition({ x: 50, y: 50 });
    setScale(1);
  }, [deviceType]);

  // 计算设备 mockup 在容器中的展示尺寸
  const device = DEVICES.find((d) => d.id === deviceType) ?? DEVICES[3];
  const aspectRatio = device.width / device.height;

  // 根据设备类型计算最大展示区域
  const getMaxDimensions = () => {
    const maxW = typeof window !== "undefined" ? window.innerWidth * 0.65 : 600;
    const maxH = typeof window !== "undefined" ? window.innerHeight * 0.6 : 500;

    if (aspectRatio >= 2) {
      // Ultrawide
      const w = Math.min(maxW, 800);
      const h = w / aspectRatio;
      return { w, h: Math.min(h, maxH) };
    } else if (aspectRatio >= 1.2) {
      // Desktop
      const w = Math.min(maxW, 600);
      const h = w / aspectRatio;
      return { w, h: Math.min(h, maxH) };
    } else {
      // 手机 / 平板 (竖屏)
      const h = Math.min(maxH, 480);
      const w = h * aspectRatio;
      return { w: Math.min(w, maxW), h };
    }
  };

  const { w: displayW, h: displayH } = getMaxDimensions();

  // 拖拽处理
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        posX: position.x,
        posY: position.y,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [position]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || !containerRef.current) return;
      e.preventDefault();

      const rect = containerRef.current.getBoundingClientRect();
      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;

      // 将像素偏移转换为百分比
      const percentX = (deltaX / rect.width) * 100;
      const percentY = (deltaY / rect.height) * 100;

      const newX = Math.max(0, Math.min(100, dragStartRef.current.posX - percentX));
      const newY = Math.max(0, Math.min(100, dragStartRef.current.posY - percentY));

      setPosition({ x: newX, y: newY });
      onPositionChange?.(newX, newY);
    },
    [isDragging, onPositionChange]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 缩放处理
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      setScale((prev) => Math.max(1, Math.min(3, prev + delta)));
    },
    []
  );

  // 渲染设备外壳
  const renderDeviceFrame = () => {
    switch (deviceType) {
      case "iphone":
        return (
          <div
            className="relative"
            style={{ width: displayW, height: displayH }}
          >
            {/* iPhone 外壳 */}
            <div
              className="absolute inset-0 rounded-[2.5rem] border-[3px] border-gray-700/90 bg-gray-900 shadow-2xl"
              style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.1), 0 25px 50px rgba(0,0,0,0.5)" }}
            >
              {/* 灵动岛 */}
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-[28%] h-[3%] bg-black rounded-full z-10" />

              {/* 底部横条 */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[30%] h-[1.2%] bg-white/30 rounded-full z-10" />
            </div>

            {/* 屏幕内容区 */}
            <div
              ref={containerRef}
              className="absolute rounded-[2.2rem] overflow-hidden cursor-grab active:cursor-grabbing"
              style={{
                top: "3px",
                left: "3px",
                right: "3px",
                bottom: "3px",
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onWheel={handleWheel}
            >
              <img
                src={imageUrl}
                alt="Wallpaper preview"
                draggable={false}
                className="absolute inset-0 w-full h-full select-none pointer-events-none"
                style={{
                  objectFit: "cover",
                  objectPosition: `${position.x}% ${position.y}%`,
                  transform: `scale(${scale})`,
                  transformOrigin: `${position.x}% ${position.y}%`,
                  transition: isDragging ? "none" : "transform 0.15s ease-out, object-position 0.15s ease-out",
                }}
              />
            </div>
          </div>
        );

      case "android":
        return (
          <div
            className="relative"
            style={{ width: displayW, height: displayH }}
          >
            {/* Android 外壳 */}
            <div
              className="absolute inset-0 rounded-[2rem] border-[3px] border-gray-700/90 bg-gray-900 shadow-2xl"
              style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.1), 0 25px 50px rgba(0,0,0,0.5)" }}
            >
              {/* 顶部挖孔摄像头 */}
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-[5%] h-[2.5%] bg-black rounded-full z-10" />
            </div>

            {/* 屏幕内容区 */}
            <div
              ref={containerRef}
              className="absolute rounded-[1.7rem] overflow-hidden cursor-grab active:cursor-grabbing"
              style={{
                top: "3px",
                left: "3px",
                right: "3px",
                bottom: "3px",
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onWheel={handleWheel}
            >
              <img
                src={imageUrl}
                alt="Wallpaper preview"
                draggable={false}
                className="absolute inset-0 w-full h-full select-none pointer-events-none"
                style={{
                  objectFit: "cover",
                  objectPosition: `${position.x}% ${position.y}%`,
                  transform: `scale(${scale})`,
                  transformOrigin: `${position.x}% ${position.y}%`,
                  transition: isDragging ? "none" : "transform 0.15s ease-out, object-position 0.15s ease-out",
                }}
              />
            </div>
          </div>
        );

      case "ipad":
        return (
          <div
            className="relative"
            style={{ width: displayW, height: displayH }}
          >
            {/* iPad 外壳 - 较粗边框 */}
            <div
              className="absolute inset-0 rounded-[1.5rem] border-[6px] border-gray-700/90 bg-gray-900 shadow-2xl"
              style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.1), 0 25px 50px rgba(0,0,0,0.5)" }}
            >
              {/* 前置摄像头 */}
              <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-[3%] h-[1.5%] bg-gray-800 rounded-full z-10 border border-gray-700" />
              {/* Home 键区域指示条 */}
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-[15%] h-[1%] bg-white/25 rounded-full z-10" />
            </div>

            {/* 屏幕内容区 */}
            <div
              ref={containerRef}
              className="absolute rounded-[1rem] overflow-hidden cursor-grab active:cursor-grabbing"
              style={{
                top: "6px",
                left: "6px",
                right: "6px",
                bottom: "6px",
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onWheel={handleWheel}
            >
              <img
                src={imageUrl}
                alt="Wallpaper preview"
                draggable={false}
                className="absolute inset-0 w-full h-full select-none pointer-events-none"
                style={{
                  objectFit: "cover",
                  objectPosition: `${position.x}% ${position.y}%`,
                  transform: `scale(${scale})`,
                  transformOrigin: `${position.x}% ${position.y}%`,
                  transition: isDragging ? "none" : "transform 0.15s ease-out, object-position 0.15s ease-out",
                }}
              />
            </div>
          </div>
        );

      case "desktop":
        return (
          <div className="flex flex-col items-center" style={{ width: displayW + 60 }}>
            {/* 显示器外壳 */}
            <div
              className="relative"
              style={{ width: displayW, height: displayH }}
            >
              {/* 显示器边框 */}
              <div
                className="absolute inset-0 rounded-[0.8rem] border-[5px] border-gray-700/90 bg-gray-900 shadow-2xl"
                style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.1), 0 25px 50px rgba(0,0,0,0.5)" }}
              >
                {/* 底部品牌标识 */}
                <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-[4%] h-[2%] bg-gray-600 rounded-sm z-10" />
              </div>

              {/* 屏幕内容区 */}
              <div
                ref={containerRef}
                className="absolute rounded-[0.4rem] overflow-hidden cursor-grab active:cursor-grabbing"
                style={{
                  top: "5px",
                  left: "5px",
                  right: "5px",
                  bottom: "5px",
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onWheel={handleWheel}
              >
                <img
                  src={imageUrl}
                  alt="Wallpaper preview"
                  draggable={false}
                  className="absolute inset-0 w-full h-full select-none pointer-events-none"
                  style={{
                    objectFit: "cover",
                    objectPosition: `${position.x}% ${position.y}%`,
                    transform: `scale(${scale})`,
                    transformOrigin: `${position.x}% ${position.y}%`,
                    transition: isDragging ? "none" : "transform 0.15s ease-out, object-position 0.15s ease-out",
                  }}
                />
              </div>
            </div>

            {/* 显示器支架 */}
            <div className="flex flex-col items-center">
              <div className="w-8 h-6 bg-gradient-to-b from-gray-700 to-gray-600" />
              <div className="w-20 h-2 bg-gradient-to-b from-gray-600 to-gray-500 rounded-b-lg" />
            </div>
          </div>
        );

      case "ultrawide":
        return (
          <div className="flex flex-col items-center" style={{ width: displayW + 60 }}>
            {/* 超宽显示器外壳 */}
            <div
              className="relative"
              style={{ width: displayW, height: displayH }}
            >
              {/* 显示器边框 */}
              <div
                className="absolute inset-0 rounded-[0.6rem] border-[4px] border-gray-700/90 bg-gray-900 shadow-2xl"
                style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.1), 0 25px 50px rgba(0,0,0,0.5)" }}
              >
                {/* 底部品牌标识 */}
                <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-[2.5%] h-[4%] bg-gray-600 rounded-sm z-10" />
              </div>

              {/* 屏幕内容区 */}
              <div
                ref={containerRef}
                className="absolute rounded-[0.3rem] overflow-hidden cursor-grab active:cursor-grabbing"
                style={{
                  top: "4px",
                  left: "4px",
                  right: "4px",
                  bottom: "4px",
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onWheel={handleWheel}
              >
                <img
                  src={imageUrl}
                  alt="Wallpaper preview"
                  draggable={false}
                  className="absolute inset-0 w-full h-full select-none pointer-events-none"
                  style={{
                    objectFit: "cover",
                    objectPosition: `${position.x}% ${position.y}%`,
                    transform: `scale(${scale})`,
                    transformOrigin: `${position.x}% ${position.y}%`,
                    transition: isDragging ? "none" : "transform 0.15s ease-out, object-position 0.15s ease-out",
                  }}
                />
              </div>
            </div>

            {/* 显示器支架 */}
            <div className="flex flex-col items-center">
              <div className="w-8 h-5 bg-gradient-to-b from-gray-700 to-gray-600" />
              <div className="w-24 h-2 bg-gradient-to-b from-gray-600 to-gray-500 rounded-b-lg" />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* 设备 Mockup */}
      <AnimatePresence mode="wait">
        <motion.div
          key={deviceType}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {renderDeviceFrame()}
        </motion.div>
      </AnimatePresence>

      {/* 缩放控制 & 提示 */}
      <div className="flex items-center gap-3 text-white/50 text-xs">
        <button
          onClick={() => setScale((s) => Math.max(1, s - 0.2))}
          className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white/70"
        >
          −
        </button>
        <span className="w-12 text-center">{Math.round(scale * 100)}%</span>
        <button
          onClick={() => setScale((s) => Math.min(3, s + 0.2))}
          className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white/70"
        >
          +
        </button>
        <span className="ml-2">拖拽调整位置 · 滚轮缩放</span>
      </div>
    </div>
  );
}