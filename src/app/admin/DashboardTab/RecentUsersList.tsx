"use client";

import type { RecentUser } from "./types";

export default function RecentUsersList({ data }: { data: RecentUser[] }) {
  return (
    <div className="space-y-2">
      {data.map((user) => (
        <div
          key={user.id}
          className="flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--color-surface-soft)] transition-colors"
        >
          <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-[var(--color-surface-card)]">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs font-medium text-[var(--color-mute)]">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-[var(--color-ash)] truncate">{user.email}</p>
          </div>
          <span className="text-xs text-[var(--color-ash)] flex-shrink-0">
            {new Date(user.createdAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
          </span>
        </div>
      ))}
      {data.length === 0 && (
        <p className="text-sm text-[var(--color-ash)] text-center py-4">
          暂无用户数据
        </p>
      )}
    </div>
  );
}
