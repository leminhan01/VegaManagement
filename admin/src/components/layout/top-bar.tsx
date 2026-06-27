"use client";

import { useState } from "react";

export function TopBar() {
  const [searchValue, setSearchValue] = useState("");

  return (
    <header className="fixed left-64 right-0 top-0 z-30 flex h-16 items-center justify-between border-b border-outline-variant bg-surface/80 px-6 backdrop-blur">
      {/* Search */}
      <div className="relative w-full max-w-md">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant">
          search
        </span>
        <input
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Tìm kiếm..."
          className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest py-2 pl-10 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <button
          type="button"
          className="relative flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-secondary-container"
        >
          <span className="material-symbols-outlined text-[22px] text-on-surface-variant">
            notifications
          </span>
          {/* Red dot badge */}
          <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-error ring-2 ring-surface" />
        </button>

        {/* Settings */}
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-secondary-container"
        >
          <span className="material-symbols-outlined text-[22px] text-on-surface-variant">
            settings
          </span>
        </button>

        {/* Người dùng avatar */}
        <button
          type="button"
          className="ml-2 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-on-primary"
        >
          AD
        </button>
      </div>
    </header>
  );
}
