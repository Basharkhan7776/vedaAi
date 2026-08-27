"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Presentation,
  FileText,
  ClipboardList,
  PieChart,
  Settings,
  Sparkles,
  PanelLeftClose,
  ChevronsRight
} from "lucide-react";

interface SidebarNavProps {
  className?: string;
  isOpen?: boolean;
  onToggle?: () => void;
  onCloseMobile?: () => void;
}

// Delhi Public School Logo Badge using /delhi-public-school.png
function DPSLogoBadge({ size = "md" }: { size?: "sm" | "md" }) {
  const boxDim = size === "sm" ? "w-8 h-8" : "w-10 h-10";
  return (
    <div
      className={`relative ${boxDim} rounded-full overflow-hidden flex items-center justify-center bg-white border border-neutral-200/80 shadow-2xs flex-shrink-0 p-0.5`}
    >
      <Image
        src="/delhi-public-school.png"
        alt="Delhi Public School"
        width={40}
        height={40}
        className="w-full h-full object-contain"
      />
    </div>
  );
}

// VedaAI Logo Badge using /logo.png
function VedaLogoBadge({ size = "md" }: { size?: "sm" | "md" }) {
  const boxDim = size === "sm" ? "w-8 h-8 rounded-lg" : "w-10 h-10 rounded-xl";
  return (
    <div
      className={`${boxDim} overflow-hidden shadow-sm flex-shrink-0 flex items-center justify-center`}
    >
      <Image
        src="/logo.png"
        alt="VedaAI"
        width={size === "sm" ? 32 : 40}
        height={size === "sm" ? 32 : 40}
        className="w-full h-full object-contain"
        priority
      />
    </div>
  );
}

export function SidebarNav({
  className = "",
  isOpen = true,
  onToggle,
  onCloseMobile,
}: SidebarNavProps) {
  const pathname = usePathname();
  const isAnalyzer = pathname.includes("/analizer");

  const navItems = [
    {
      label: "Home",
      href: "/",
      icon: LayoutGrid,
      active: false,
    },
    {
      label: "My Classroom",
      href: "#",
      icon: Presentation,
      active: false,
    },
    {
      label: "Assignments",
      href: "#",
      icon: FileText,
      active: false,
    },
    {
      label: "Exams",
      href: isAnalyzer ? "/analizer" : "/",
      icon: ClipboardList,
      active: true, // Only Exams is highlighted
    },
    {
      label: "My Library",
      href: "#",
      icon: PieChart,
      active: false,
    },
  ];

  // -------------------------------------------------------------
  // 1. COLLAPSED / CLOSED STATE (Matching Image 2)
  // -------------------------------------------------------------
  if (!isOpen) {
    return (
      <aside
        className={`w-16 bg-white rounded-3xl p-3.5 flex flex-col justify-between items-center shadow-sm border border-neutral-200/80 select-none transition-all duration-300 ${className}`}
      >
        {/* Top Section with clean gaps */}
        <div className="flex flex-col items-center w-full">
          {/* 1. Logo Badge */}
          <Link
            href="/"
            onClick={onCloseMobile}
            className="hover:scale-105 transition-transform mb-5"
            title="VedaAI"
          >
            <VedaLogoBadge size="md" />
          </Link>

          {/* 2. AI Teacher's Toolkit Circle Icon */}
          <div className="mb-6">
            <button
              type="button"
              className="w-11 h-11 rounded-full bg-[#292A2D] border-2 border-[#F95738] shadow-[0_0_12px_rgba(249,87,56,0.4)] flex items-center justify-center text-white hover:scale-105 transition-all cursor-pointer group"
              title="AI Teacher's Toolkit"
            >
              <Sparkles className="w-5 h-5 fill-white text-white group-hover:rotate-12 transition-transform" />
            </button>
          </div>

          {/* 3. List of Nav Icons */}
          <nav className="flex flex-col items-center gap-3 w-full">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={onCloseMobile}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    item.active
                      ? "bg-[#F0F0EE] text-neutral-900 shadow-2xs font-semibold"
                      : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                  }`}
                  title={item.label}
                >
                  <Icon className="w-5 h-5 stroke-[2]" />
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Settings on top of school + expand button */}
        <div className="flex flex-col items-center gap-3 w-full">
          {/* Settings Icon */}
          <Link
            href="#"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-all"
            title="Settings"
          >
            <Settings className="w-5 h-5 stroke-[1.8]" />
          </Link>

          {/* School Badge Icon */}
          <div
            className="cursor-pointer hover:scale-105 transition-transform"
            title="Delhi Public School, Bokaro Steel City"
          >
            <DPSLogoBadge size="sm" />
          </div>

          {/* Expand >> Toggle Button */}
          {onToggle && (
            <button
              onClick={onToggle}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
              title="Expand Sidebar"
            >
              <ChevronsRight className="w-5 h-5 stroke-[2.5]" />
            </button>
          )}
        </div>
      </aside>
    );
  }

  // -------------------------------------------------------------
  // 2. EXPANDED / OPEN STATE (Matching Image 1)
  // -------------------------------------------------------------
  return (
    <aside
      className={`w-64 bg-white rounded-3xl p-5 flex flex-col justify-between shadow-sm border border-neutral-200/80 select-none transition-all duration-300 ${className}`}
    >
      {/* Top Header & Toolkit Button & Nav List */}
      <div className="flex flex-col">
        {/* 1. Brand Logo & Close Toggle */}
        <div className="flex items-center justify-between pb-6">
          <Link
            href="/"
            onClick={onCloseMobile}
            className="flex items-center gap-3 group"
          >
            <VedaLogoBadge size="md" />
            <span className="font-extrabold text-2xl text-neutral-900 tracking-tight font-sans">
              VedaAI
            </span>
          </Link>

          {/* Sidebar Collapse Toggle Button */}
          {onToggle && (
            <button
              onClick={onToggle}
              className="p-1.5 text-neutral-400 hover:text-neutral-800 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
              title="Close Sidebar"
            >
              <PanelLeftClose className="w-5 h-5 stroke-[2]" />
            </button>
          )}
        </div>

        {/* 2. AI Teacher's Toolkit Pill Button */}
        <div className="pt-1 pb-7">
          <button
            type="button"
            className="w-full py-3 px-4 rounded-full bg-[#292A2D] text-white flex items-center justify-center gap-2.5 font-medium text-sm border-2 border-[#F95738] shadow-[0_0_14px_rgba(249,87,56,0.35)] hover:bg-[#34363A] transition-all cursor-pointer group"
          >
            <Sparkles className="w-4 h-4 fill-white text-white group-hover:rotate-12 transition-transform" />
            <span className="tracking-wide">AI Teacher’s Toolkit</span>
          </button>
        </div>

        {/* 3. Navigation List */}
        <nav className="space-y-1.5 text-sm font-medium">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={onCloseMobile}
                className={`flex items-center gap-3.5 px-3.5 py-3 rounded-2xl transition-all ${
                  item.active
                    ? "bg-[#F0F0EE] text-neutral-900 font-semibold shadow-2xs"
                    : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${
                    item.active
                      ? "text-neutral-900 stroke-[2.2]"
                      : "text-neutral-500 stroke-[1.8]"
                  }`}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section: Settings on top of school profile card */}
      <div className="space-y-2.5 pt-4">
        {/* Settings link on top of School */}
        <Link
          href="#"
          className="flex items-center gap-3.5 px-3.5 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 rounded-2xl transition-colors"
        >
          <Settings className="w-5 h-5 text-neutral-500 stroke-[1.8]" />
          <span>Settings</span>
        </Link>

        {/* School Organization Card */}
        <div className="bg-[#F0F0EE] rounded-2xl p-3 flex items-center gap-3 border border-neutral-200/60 shadow-2xs">
          <DPSLogoBadge size="md" />

          <div className="min-w-0">
            <h4 className="font-bold text-xs text-neutral-900 truncate">
              Delhi Public School
            </h4>
            <p className="text-[11px] text-neutral-500 truncate font-normal mt-0.5">
              Bokaro Steel City
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
