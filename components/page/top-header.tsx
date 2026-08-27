"use client";

import React from "react";
import {
  Search,
  HelpCircle,
  Bell,
  Sun,
  Menu,
  ChevronRight,
} from "lucide-react";

interface TopHeaderProps {
  onOpenMobileMenu?: () => void;
  crumb?: string;
  userName?: string;
}

export function TopHeader({
  onOpenMobileMenu,
  crumb = "Exams",
  userName = "Madhur Rastogi",
}: TopHeaderProps) {
  return (
    <header className="h-[64px] px-4 md:px-6 border-b border-neutral-200/70 bg-white/75 backdrop-blur-md flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        {onOpenMobileMenu && (
          <button
            onClick={onOpenMobileMenu}
            className="p-2 -ml-1 text-neutral-600 hover:text-neutral-900 lg:hidden rounded-lg hover:bg-neutral-100"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="hidden sm:flex items-center w-[220px] md:w-[260px] h-10 rounded-xl border border-neutral-200 bg-white px-3 gap-2 text-neutral-400">
          <Search className="w-4 h-4 shrink-0" />
          <input
            type="search"
            placeholder="Search"
            className="flex-1 bg-transparent text-sm text-neutral-800 placeholder:text-neutral-400 outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 text-sm text-neutral-400 font-medium">
          <ChevronRight className="w-4 h-4 opacity-50" />
          <span className="text-neutral-500">{crumb}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="w-9 h-9 rounded-xl bg-[#f6f6f6] text-[#303030] font-bold text-sm flex items-center justify-center hover:bg-neutral-200/80"
          title="Help"
        >
          ?
        </button>
        <button
          type="button"
          className="relative w-9 h-9 rounded-xl bg-[#f6f6f6] text-neutral-700 flex items-center justify-center hover:bg-neutral-200/80"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#ff5623]" />
        </button>
        <button
          type="button"
          className="w-9 h-9 rounded-xl bg-white border border-neutral-200 text-neutral-700 flex items-center justify-center hover:bg-neutral-50"
          title="Theme"
        >
          <Sun className="w-4 h-4" />
        </button>
        <div className="hidden md:flex items-center gap-2 pl-1">
          <div className="w-8 h-8 rounded-full bg-[#f6f6f6] text-[#303030] text-xs font-bold flex items-center justify-center">
            MR
          </div>
          <span className="text-sm font-semibold text-[#303030]">{userName}</span>
        </div>
      </div>
    </header>
  );
}
