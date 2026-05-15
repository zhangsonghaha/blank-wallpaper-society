"use client";

import { DEVICES, type DeviceType } from "./DeviceMockup";
import { Monitor, Smartphone, Tablet } from "lucide-react";

interface DeviceSelectorProps {
  selected: string;
  onSelect: (device: DeviceType) => void;
}

// 设备图标映射
const deviceIcons: Record<DeviceType, React.ReactNode> = {
  iphone: <Smartphone className="w-5 h-5" />,
  android: <Smartphone className="w-5 h-5" />,
  ipad: <Tablet className="w-5 h-5" />,
  desktop: <Monitor className="w-5 h-5" />,
  ultrawide: <Monitor className="w-5 h-5" />,
};

export default function DeviceSelector({ selected, onSelect }: DeviceSelectorProps) {
  return (
    <div className="flex items-center gap-1 px-2 py-1.5 rounded-2xl bg-white/10 backdrop-blur-sm">
      {DEVICES.map((device) => {
        const isActive = selected === device.id;
        return (
          <button
            key={device.id}
            onClick={() => onSelect(device.id)}
            className={`
              flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200
              ${isActive
                ? "bg-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary)]/25"
                : "text-white/60 hover:text-white/90 hover:bg-white/10"
              }
            `}
          >
            <span className={isActive ? "scale-110" : ""} style={{ transition: "transform 0.2s" }}>
              {deviceIcons[device.id]}
            </span>
            <span className="text-[10px] font-medium leading-tight">{device.name}</span>
            <span className="text-[9px] opacity-70 leading-tight">{device.label}</span>
          </button>
        );
      })}
    </div>
  );
}