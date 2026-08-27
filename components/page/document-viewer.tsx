"use client";

import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { QuestionEvaluation } from "./mock-data";
import { sessionPageUrl } from "@/lib/api/evaluation";

interface DocumentViewerProps {
  questions: QuestionEvaluation[];
  selectedQuestionId: string;
  onSelectQuestion: (questionId: string) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
  totalPages?: number;
  sessionId?: string | null;
  pdfUrl?: string;
}

function regionsForQuestion(q: QuestionEvaluation) {
  if (q.regions && q.regions.length > 0) return q.regions;
  return [{ page: q.page, box: q.boundingBox }];
}

export function DocumentViewer({
  questions,
  selectedQuestionId,
  onSelectQuestion,
  currentPage = 1,
  onPageChange,
  totalPages = 4,
  sessionId = null,
}: DocumentViewerProps) {
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const pageImageUrl = sessionId
    ? sessionPageUrl(sessionId, currentPage)
    : null;

  const overlays = useMemo(
    () =>
      questions.flatMap((q) =>
        regionsForQuestion(q)
          .filter((r) => r.page === currentPage)
          .map((r) => ({ question: q, box: r.box })),
      ),
    [questions, currentPage],
  );

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 10, 200));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 10, 50));

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-neutral-200/90 shadow-xs overflow-hidden select-none">
      <div className="h-12 bg-[#292A2D] px-4 flex items-center justify-between text-white flex-shrink-0">
        <span className="font-bold text-sm tracking-tight text-white">
          Answer Sheet
        </span>

        <div className="flex items-center gap-2.5">
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

          <div className="flex items-center bg-[#3A3D42] rounded-lg px-2 py-1 text-xs text-neutral-200 gap-1.5 shadow-2xs">
            <button
              onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
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
              onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
              disabled={currentPage >= totalPages}
              className="hover:text-white transition-colors cursor-pointer disabled:opacity-40"
              title="Next page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-[#EBEBE8] overflow-auto p-4 flex items-start justify-center">
        <div
          style={{
            transform: `scale(${zoomLevel / 100})`,
            transformOrigin: "top center",
          }}
          className="transition-transform duration-200"
        >
          {pageImageUrl ? (
            <div className="relative w-[640px] max-w-[90vw] bg-white rounded-xl shadow-md border border-neutral-300/80 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pageImageUrl}
                alt={`Answer sheet page ${currentPage}`}
                className="block w-full h-auto"
                draggable={false}
              />
              <div className="absolute inset-0 pointer-events-none z-10">
                {overlays.map(({ question: q, box }, idx) => {
                  if (!box?.width || !box?.height) return null;
                  const active =
                    selectedQuestionId === q.id || hoveredId === q.id;
                  return (
                    <div
                      key={`${q.id}-${idx}`}
                      onClick={() => onSelectQuestion(q.id)}
                      onMouseEnter={() => setHoveredId(q.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      style={{
                        left: `${box.x}%`,
                        top: `${box.y}%`,
                        width: `${box.width}%`,
                        height: `${box.height}%`,
                      }}
                      className={`absolute pointer-events-auto cursor-pointer transition-all ${
                        active
                          ? "bg-amber-300/40 ring-2 ring-[#FF5722]/80"
                          : "bg-amber-200/15 ring-1 ring-amber-400/30"
                      }`}
                    >
                      <span className="absolute -top-0.5 -left-0.5 w-3 h-3 border-t-2 border-l-2 border-[#FF5722]" />
                      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 border-t-2 border-r-2 border-[#FF5722]" />
                      <span className="absolute -bottom-0.5 -left-0.5 w-3 h-3 border-b-2 border-l-2 border-[#FF5722]" />
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 border-b-2 border-r-2 border-[#FF5722]" />
                      {active && (
                        <span className="absolute -top-6 left-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FF5722] text-white shadow-sm">
                          Q{q.number ?? q.questionNumber} · Answer Region
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="w-full max-w-2xl min-h-[600px] bg-white rounded-xl shadow-md border border-neutral-300/80 flex flex-col items-center justify-center p-8">
              <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-400 mb-3 shadow-2xs">
                <FileText className="w-7 h-7 stroke-[1.5]" />
              </div>
              <p className="text-sm font-bold text-neutral-700">
                Answer Sheet Page {currentPage}
              </p>
              <p className="text-xs text-neutral-400 mt-1 text-center max-w-xs">
                {sessionId
                  ? "Waiting for page image…"
                  : "Upload & map a session to view the scanned answer sheet with AI highlights."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
