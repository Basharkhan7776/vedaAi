"use client";

import React, { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  FileText
} from "lucide-react";
import { QuestionEvaluation } from "./mock-data";

interface DocumentViewerProps {
  questions: QuestionEvaluation[];
  selectedQuestionId: string;
  onSelectQuestion: (questionId: string) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
  totalPages?: number;
  pdfUrl?: string;
}

export function DocumentViewer({
  currentPage = 1,
  onPageChange,
  totalPages = 4,
}: DocumentViewerProps) {
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 10, 200));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 10, 50));

  const handlePrevPage = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-neutral-200/90 shadow-xs overflow-hidden select-none">
      {/* 1. Dark Top Toolbar (Matching Figma Reference: Answer Sheet | - 100% + | < Page 1 of 4 >) */}
      <div className="h-12 bg-[#292A2D] px-4 flex items-center justify-between text-white flex-shrink-0">
        {/* Left: Answer Sheet Label */}
        <span className="font-bold text-sm tracking-tight text-white">
          Answer Sheet
        </span>

        {/* Right: Zoom & Pagination Pills */}
        <div className="flex items-center gap-2.5">
          {/* Zoom Control Pill */}
          <div className="flex items-center bg-[#3A3D42] rounded-lg px-2 py-1 text-xs text-neutral-200 gap-2 shadow-2xs">
            <button
              onClick={handleZoomOut}
              className="hover:text-white transition-colors cursor-pointer disabled:opacity-40"
              disabled={zoomLevel <= 50}
              title="Zoom out"
            >
              -
            </button>
            <span className="font-mono font-medium text-[11px] min-w-[36px] text-center text-white">
              {zoomLevel}%
            </span>
            <button
              onClick={handleZoomIn}
              className="hover:text-white transition-colors cursor-pointer disabled:opacity-40"
              disabled={zoomLevel >= 200}
              title="Zoom in"
            >
              +
            </button>
          </div>

          {/* Pagination Pill */}
          <div className="flex items-center bg-[#3A3D42] rounded-lg px-2 py-1 text-xs text-neutral-200 gap-1.5 shadow-2xs">
            <button
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
              className="hover:text-white transition-colors cursor-pointer disabled:opacity-40"
              title="Previous page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-medium text-[11px] px-1 text-white">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={handleNextPage}
              disabled={currentPage >= totalPages}
              className="hover:text-white transition-colors cursor-pointer disabled:opacity-40"
              title="Next page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Empty Document / PDF Canvas Ready for Future PDF Integration */}
      <div className="flex-1 bg-[#EBEBE8] overflow-auto p-4 flex items-center justify-center">
        <div
          style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: "top center" }}
          className="w-full max-w-2xl min-h-[600px] bg-white rounded-xl shadow-md border border-neutral-300/80 flex flex-col items-center justify-center p-8 transition-transform duration-200"
        >
          {/* Subtle Empty State Placeholder */}
          <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-400 mb-3 shadow-2xs">
            <FileText className="w-7 h-7 stroke-[1.5]" />
          </div>
          <p className="text-sm font-bold text-neutral-700">
            Answer Sheet Page {currentPage}
          </p>
          <p className="text-xs text-neutral-400 mt-1 text-center max-w-xs">
            Scanned response sheet viewer container (ready for PDF integration).
          </p>
        </div>
      </div>
    </div>
  );
}
