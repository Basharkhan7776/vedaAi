"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sparkles,
  Plus,
  FileText,
  Clock,
  Settings,
  HelpCircle,
  LogOut,
  CheckCircle2,
  ChevronRight,
  BookOpen,
  FolderArchive,
  BarChart3,
  Layers,
  GraduationCap
} from "lucide-react";
import { RECENT_EVALUATIONS } from "./mock-data";

interface SidebarNavProps {
  className?: string;
  onCloseMobile?: () => void;
}

export function SidebarNav({ className = "", onCloseMobile }: SidebarNavProps) {
  const pathname = usePathname();
  const isAnalyzer = pathname.includes("/analizer");

  return (
    <aside
      className={`w-64 bg-white border-r border-neutral-200/80 flex flex-col justify-between h-full select-none ${className}`}
    >
      {/* Top Header & Brand */}
      <div className="flex flex-col">
        <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
          <Link
            href="/"
            onClick={onCloseMobile}
            className="flex items-center gap-2.5 group"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-orange-600 via-orange-500 to-amber-400 flex items-center justify-center text-white shadow-sm shadow-orange-500/20 group-hover:scale-105 transition-transform">
              <Sparkles className="w-4 h-4 fill-white/80" />
            </div>
            <div>
              <span className="font-bold text-lg text-neutral-900 tracking-tight flex items-center gap-1.5">
                Veda <span className="text-orange-600 font-extrabold text-xs px-1.5 py-0.5 rounded bg-orange-50 border border-orange-200">AI</span>
              </span>
            </div>
          </Link>
        </div>

        {/* New Evaluation Action Button */}
        <div className="p-3">
          <Link
            href="/"
            onClick={onCloseMobile}
            className={`w-full py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 font-medium text-sm transition-all shadow-sm ${
              pathname === "/"
                ? "bg-gradient-to-r from-neutral-900 to-neutral-800 text-white shadow-neutral-900/10 hover:opacity-95"
                : "bg-orange-600 hover:bg-orange-700 text-white shadow-orange-600/20"
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>New Evaluation</span>
          </Link>
        </div>

        {/* Navigation Section */}
        <div className="px-3 py-2">
          <p className="px-2 pb-1.5 text-[11px] font-semibold tracking-wider text-neutral-400 uppercase">
            Workspace
          </p>
          <nav className="space-y-0.5 text-sm">
            <Link
              href="/"
              onClick={onCloseMobile}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg font-medium transition-colors ${
                pathname === "/"
                  ? "bg-orange-50/80 text-orange-700"
                  : "text-neutral-600 hover:bg-neutral-100/80 hover:text-neutral-900"
              }`}
            >
              <FileText className={`w-4 h-4 ${pathname === "/" ? "text-orange-600" : "text-neutral-400"}`} />
              <span>Upload & Evaluator</span>
            </Link>

            <Link
              href="/analizer"
              onClick={onCloseMobile}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg font-medium transition-colors ${
                isAnalyzer
                  ? "bg-orange-50/80 text-orange-700"
                  : "text-neutral-600 hover:bg-neutral-100/80 hover:text-neutral-900"
              }`}
            >
              <Layers className={`w-4 h-4 ${isAnalyzer ? "text-orange-600" : "text-neutral-400"}`} />
              <span>Evaluation Analyzer</span>
              <span className="ml-auto text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.2 rounded-full font-semibold">
                Live
              </span>
            </Link>
          </nav>
        </div>

        {/* Recent Evaluations History */}
        <div className="px-3 py-2">
          <div className="flex items-center justify-between px-2 pb-1.5">
            <p className="text-[11px] font-semibold tracking-wider text-neutral-400 uppercase">
              Recent Evaluations
            </p>
            <Clock className="w-3 h-3 text-neutral-400" />
          </div>

          <div className="space-y-1 mt-1 max-h-56 overflow-y-auto pr-0.5">
            {RECENT_EVALUATIONS.map((evalItem) => {
              const active = isAnalyzer && evalItem.id === "session-veda-101";
              return (
                <Link
                  key={evalItem.id}
                  href="/analizer"
                  onClick={onCloseMobile}
                  className={`group flex items-start gap-2 p-2 rounded-lg transition-all text-left ${
                    active
                      ? "bg-neutral-100 text-neutral-900 font-medium"
                      : "hover:bg-neutral-50 text-neutral-600"
                  }`}
                >
                  <div className="mt-0.5 w-6 h-6 rounded bg-neutral-100 text-neutral-500 flex items-center justify-center flex-shrink-0 group-hover:bg-orange-100 group-hover:text-orange-600 transition-colors">
                    <BookOpen className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-neutral-800 truncate group-hover:text-orange-600 transition-colors">
                      {evalItem.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-neutral-400">
                      <span>{evalItem.student}</span>
                      <span>•</span>
                      <span className="font-semibold text-emerald-600">{evalItem.score}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer / Account Section */}
      <div className="p-3 border-t border-neutral-200/80 bg-neutral-50/50 space-y-2">
        {/* Usage progress */}
        <div className="px-2 py-1.5 rounded-lg bg-white border border-neutral-200/70 text-xs">
          <div className="flex justify-between items-center text-[11px] text-neutral-500 font-medium mb-1">
            <span>AI Credits</span>
            <span className="text-neutral-800 font-semibold">1,420 / 2,000</span>
          </div>
          <div className="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 h-full rounded-full w-[71%]" />
          </div>
        </div>

        {/* User Card */}
        <div className="flex items-center justify-between p-1.5 rounded-lg hover:bg-neutral-100 transition-colors">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-orange-100 border border-orange-200 text-orange-700 flex items-center justify-center font-bold text-xs">
              BK
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-neutral-800 truncate">Bashar Khan</p>
              <p className="text-[10px] text-neutral-400 truncate">bashar@vedaai.com</p>
            </div>
          </div>
          <div className="flex items-center text-neutral-400 hover:text-neutral-700 p-1">
            <Settings className="w-4 h-4" />
          </div>
        </div>
      </div>
    </aside>
  );
}
