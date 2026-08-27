"use client";

import React, { useState, useRef } from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Download,
  Share2,
  FileCheck2,
  Layers
} from "lucide-react";
import { QuestionEvaluation, SAMPLE_EVALUATION } from "./mock-data";

interface DocumentViewerProps {
  questions: QuestionEvaluation[];
  selectedQuestionId: string | null;
  onSelectQuestion: (questionId: string) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
  totalPages: number;
  /** When set, render real rasterized page images from the session API */
  sessionId?: string | null;
}

function regionsForQuestion(q: QuestionEvaluation) {
  if (q.regions && q.regions.length > 0) return q.regions;
  return [{ page: q.page, box: q.boundingBox }];
}

export function DocumentViewer({
  questions,
  selectedQuestionId,
  onSelectQuestion,
  currentPage,
  onPageChange,
  totalPages,
  sessionId = null,
}: DocumentViewerProps) {
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [showAnnotations, setShowAnnotations] = useState<boolean>(true);
  const [hoveredQuestionId, setHoveredQuestionId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const pageOverlays = questions.flatMap((q) =>
    regionsForQuestion(q)
      .filter((r) => r.page === currentPage)
      .map((r) => ({ question: q, box: r.box })),
  );

  const pageImageUrl = sessionId
    ? `/api/sessions/${sessionId}/pages/${currentPage}`
    : null;

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 15, 180));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 15, 70));
  const handleZoomReset = () => setZoomLevel(100);

  return (
    <div className="flex flex-col h-full bg-neutral-100/90 border border-neutral-200/80 rounded-2xl overflow-hidden shadow-inner">
      {/* Top Document Toolbar */}
      <div className="bg-white px-4 py-2.5 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-3 select-none">
        {/* Page Switcher */}
        <div className="flex items-center gap-1.5 bg-neutral-100/80 p-1 rounded-xl border border-neutral-200/60">
          <button
            onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
            disabled={currentPage <= 1}
            className="p-1 rounded-lg hover:bg-white text-neutral-700 disabled:opacity-30 disabled:hover:bg-transparent transition-all shadow-xs"
            title="Previous Page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-semibold text-neutral-700 px-2 min-w-[75px] text-center">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
            disabled={currentPage >= totalPages}
            className="p-1 rounded-lg hover:bg-white text-neutral-700 disabled:opacity-30 disabled:hover:bg-transparent transition-all shadow-xs"
            title="Next Page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom & View Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-neutral-100/80 rounded-xl p-1 border border-neutral-200/60 text-neutral-700">
            <button
              onClick={handleZoomOut}
              className="p-1 rounded-lg hover:bg-white transition-all text-neutral-600"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleZoomReset}
              className="text-xs font-mono font-medium px-2 hover:text-orange-600 transition-colors"
              title="Reset Zoom"
            >
              {zoomLevel}%
            </button>
            <button
              onClick={handleZoomIn}
              className="p-1 rounded-lg hover:bg-white transition-all text-neutral-600"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Toggle Annotation Layer */}
          <button
            onClick={() => setShowAnnotations(!showAnnotations)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${
              showAnnotations
                ? "bg-orange-50 border-orange-200 text-orange-700 shadow-xs"
                : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            {showAnnotations ? (
              <>
                <Eye className="w-3.5 h-3.5 text-orange-600" />
                <span>Highlights On</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                <span>Highlights Off</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Scanned Answer Sheet Canvas / Viewport */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-4 sm:p-6 flex justify-center items-start"
      >
        <div
          style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: "top center" }}
          className="transition-transform duration-200 ease-out"
        >
          {pageImageUrl ? (
            <div className="relative w-[680px] bg-white rounded-lg shadow-xl border border-neutral-300 overflow-hidden select-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pageImageUrl}
                alt={`Answer sheet page ${currentPage}`}
                className="block w-full h-auto"
                draggable={false}
              />
              {showAnnotations && (
                <div className="absolute inset-0 pointer-events-none z-20">
                  {pageOverlays.map(({ question: q, box }, idx) => {
                    const isSelected = selectedQuestionId === q.id;
                    const isHovered = hoveredQuestionId === q.id;
                    const borderColor =
                      q.status === "correct"
                        ? "border-emerald-500"
                        : q.status === "partial"
                          ? "border-amber-500"
                          : q.status === "unanswered"
                            ? "border-neutral-400"
                            : "border-red-500";
                    const bgColor =
                      q.status === "correct"
                        ? isSelected || isHovered
                          ? "bg-emerald-500/20"
                          : "bg-emerald-500/10"
                        : q.status === "partial"
                          ? isSelected || isHovered
                            ? "bg-amber-500/25"
                            : "bg-amber-500/10"
                          : isSelected || isHovered
                            ? "bg-red-500/20"
                            : "bg-red-500/10";
                    const badgeBg =
                      q.status === "correct"
                        ? "bg-emerald-600 text-white"
                        : q.status === "partial"
                          ? "bg-amber-600 text-white"
                          : q.status === "unanswered"
                            ? "bg-neutral-600 text-white"
                            : "bg-red-600 text-white";

                    if (!box.width || !box.height) return null;

                    return (
                      <div
                        key={`${q.id}-${idx}`}
                        onClick={() => onSelectQuestion(q.id)}
                        onMouseEnter={() => setHoveredQuestionId(q.id)}
                        onMouseLeave={() => setHoveredQuestionId(null)}
                        style={{
                          left: `${box.x}%`,
                          top: `${box.y}%`,
                          width: `${box.width}%`,
                          height: `${box.height}%`,
                        }}
                        className={`absolute rounded-xl border-2 pointer-events-auto cursor-pointer transition-all duration-150 ${borderColor} ${bgColor} ${
                          isSelected
                            ? "ring-4 ring-orange-500/40 shadow-lg scale-[1.005]"
                            : isHovered
                              ? "ring-2 ring-neutral-400/30"
                              : ""
                        }`}
                      >
                        <div className="absolute -top-3.5 left-3 flex items-center gap-1.5 shadow-sm">
                          <span
                            className={`text-[10px] font-sans font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${badgeBg}`}
                          >
                            <span>Q{q.number ?? q.questionNumber}:</span>
                            <span>
                              {q.marksObtained}/{q.maxMarks} M
                            </span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
          /* Demo notebook paper (used when no rasterized pages exist) */
          <div className="relative w-[680px] min-h-[960px] bg-[#FCFBF7] text-neutral-900 rounded-lg shadow-xl border border-neutral-300 p-8 select-none font-serif">
            {/* Ruled Notebook Lines Background */}
            <div
              className="absolute inset-0 pointer-events-none opacity-40 rounded-lg"
              style={{
                backgroundImage:
                  "linear-gradient(to bottom, #dbe4f0 1px, transparent 1px)",
                backgroundSize: "100% 28px",
                marginTop: "70px",
              }}
            />

            {/* Red Left Margin Line */}
            <div className="absolute top-0 bottom-0 left-16 w-[1.5px] bg-red-300 pointer-events-none" />

            {/* Answer Sheet Header */}
            <div className="relative z-10 border-b-2 border-neutral-800 pb-3 mb-6 flex items-start justify-between">
              <div>
                <p className="text-[10px] tracking-widest uppercase font-sans font-bold text-neutral-500">
                  CBSE Secondary School Examination 2026
                </p>
                <h3 className="font-sans font-extrabold text-base text-neutral-900 tracking-tight">
                  Subject: Mathematics (041) — Standard
                </h3>
              </div>
              <div className="text-right text-xs font-sans text-neutral-600">
                <p>
                  Student: <span className="font-bold text-neutral-900">Aarav Sharma</span>
                </p>
                <p>
                  Roll No: <span className="font-mono font-semibold">104092</span> | Page {currentPage}/2
                </p>
              </div>
            </div>

            {/* Page Content Simulator: Realistic Handwritten-style mathematical steps */}
            {currentPage === 1 ? (
              <div className="relative z-10 space-y-7 pl-10 font-sans text-[13px] leading-relaxed text-neutral-800">
                {/* Q1 Response Section */}
                <div
                  id="doc-section-q1"
                  className={`p-3 rounded-lg transition-all ${
                    selectedQuestionId === "q1" ? "bg-orange-50/40" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-neutral-900 font-mono text-sm">
                    <span className="px-1.5 py-0.5 bg-neutral-200 text-neutral-800 rounded text-xs">
                      Ans 1.
                    </span>
                    <span>2x² - 7x + 3 = 0</span>
                  </div>
                  <div className="mt-2 space-y-1 font-mono text-xs pl-2 text-neutral-700">
                    <p>Comparing with standard form ax² + bx + c = 0 :</p>
                    <p className="pl-4">a = 2 ,  b = -7 ,  c = 3</p>
                    <p>Discriminant D = b² - 4ac</p>
                    <p className="pl-4">D = (-7)² - 4(2)(3) = 49 - 24 = 25 &gt; 0</p>
                    <p>Using quadratic formula:</p>
                    <p className="pl-4">x = [-b ± √D] / 2a</p>
                    <p className="pl-4">x = [-(-7) ± √25] / (2 × 2) = (7 ± 5) / 4</p>
                    <p className="pl-6 font-semibold text-neutral-900">
                      x₁ = (7 + 5)/4 = 12/4 = <span className="underline decoration-neutral-800 font-bold">3</span>
                    </p>
                    <p className="pl-6 font-semibold text-neutral-900">
                      x₂ = (7 - 5)/4 = 2/4 = <span className="underline decoration-neutral-800 font-bold">1/2</span>
                    </p>
                    <p className="text-[11px] font-bold text-neutral-900 pt-1">
                      ∴ Roots of given equation are 3 and 1/2.
                    </p>
                  </div>
                </div>

                {/* Q2 Response Section */}
                <div
                  id="doc-section-q2"
                  className={`p-3 rounded-lg transition-all ${
                    selectedQuestionId === "q2" ? "bg-orange-50/40" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-neutral-900 font-mono text-sm">
                    <span className="px-1.5 py-0.5 bg-neutral-200 text-neutral-800 rounded text-xs">
                      Ans 2.
                    </span>
                    <span>Arithmetic Progression (AP)</span>
                  </div>
                  <div className="mt-2 space-y-1 font-mono text-xs pl-2 text-neutral-700">
                    <p>Given first term (a) = 5, common difference (d) = 3, n = 10</p>
                    <p className="font-semibold text-neutral-800">(i) 10th term a₁₀:</p>
                    <p className="pl-4">a_n = a + (n - 1)d</p>
                    <p className="pl-4">a₁₀ = 5 + (10 - 1) × 3 = 5 + 9(3) = 5 + 27 = <span className="font-bold underline">32</span></p>
                    <p className="font-semibold text-neutral-800 pt-1">(ii) Sum of first 10 terms S₁₀:</p>
                    <p className="pl-4">S_n = (n/2) [2a + (n - 1)d]</p>
                    <p className="pl-4">S₁₀ = (10/2) [2(5) + 9(3)] = 5 [10 + 27] = 5 × 37 = <span className="font-bold underline">185</span></p>
                    <p className="text-[11px] font-bold text-neutral-900 pt-1">
                      Ans: 10th term = 32, Sum S₁₀ = 185.
                    </p>
                  </div>
                </div>

                {/* Q3 Response Section (Contains the subtle trigonometric slip) */}
                <div
                  id="doc-section-q3"
                  className={`p-3 rounded-lg transition-all ${
                    selectedQuestionId === "q3" ? "bg-orange-50/40" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-neutral-900 font-mono text-sm">
                    <span className="px-1.5 py-0.5 bg-neutral-200 text-neutral-800 rounded text-xs">
                      Ans 3.
                    </span>
                    <span>Trigonometric Identity Proof</span>
                  </div>
                  <div className="mt-2 space-y-1 font-mono text-xs pl-2 text-neutral-700">
                    <p>LHS = [sin θ / (1 + cos θ)] + [(1 + cos θ) / sin θ]</p>
                    <p className="pl-4">= [sin² θ + (1 + cos θ)²] / [sin θ(1 + cos θ)]</p>
                    <p className="pl-4">= [sin² θ + 1 + 2cos θ + cos² θ] / [sin θ(1 + cos θ)]</p>
                    <p className="pl-4">Using sin² θ + cos² θ = 1:</p>
                    <p className="pl-4">= [1 + 1 + 2cos θ] / [sin θ(1 + cos θ)]</p>
                    <p className="pl-4">= [2 + 2cos θ] / [sin θ(1 + cos θ)] = 2(1 + cos θ) / [sin θ(1 + cos θ)]</p>
                    <p className="pl-4">= 2 / sin θ = <span className="text-amber-800 font-bold bg-amber-100/70 px-1 rounded">2 sec θ</span>  (slip: wrote sec instead of cosec)</p>
                    <p className="text-[11px] font-semibold text-neutral-800 pt-1">
                      = RHS. Hence Proved.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative z-10 space-y-7 pl-10 font-sans text-[13px] leading-relaxed text-neutral-800">
                {/* Q4 Section */}
                <div
                  id="doc-section-q4"
                  className={`p-3 rounded-lg transition-all ${
                    selectedQuestionId === "q4" ? "bg-orange-50/40" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-neutral-900 font-mono text-sm">
                    <span className="px-1.5 py-0.5 bg-neutral-200 text-neutral-800 rounded text-xs">
                      Ans 4.
                    </span>
                    <span>Section Formula (Coordinate Geometry)</span>
                  </div>
                  <div className="mt-2 space-y-1 font-mono text-xs pl-2 text-neutral-700">
                    <p>Given points A(-1, 7) and B(4, -3). Ratio m₁ : m₂ = 2 : 3</p>
                    <p>By Section Formula P(x, y) = [(m₁x₂ + m₂x₁)/(m₁+m₂), (m₁y₂ + m₂y₁)/(m₁+m₂)]</p>
                    <p className="pl-4">x = [2(4) + 3(-1)] / (2 + 3) = (8 - 3)/5 = 5/5 = <span className="font-bold underline">1</span></p>
                    <p className="pl-4">y = [2(-3) + 3(7)] / (2 + 3) = (-6 + 21)/5 = 15/5 = <span className="font-bold underline">3</span></p>
                    <p className="text-[11px] font-bold text-neutral-900 pt-1">
                      ∴ Coordinates of Point P are (1, 3).
                    </p>
                  </div>
                </div>

                {/* Q5 Section */}
                <div
                  id="doc-section-q5"
                  className={`p-3 rounded-lg transition-all ${
                    selectedQuestionId === "q5" ? "bg-orange-50/40" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-neutral-900 font-mono text-sm">
                    <span className="px-1.5 py-0.5 bg-neutral-200 text-neutral-800 rounded text-xs">
                      Ans 5.
                    </span>
                    <span>Surface Area of Toy (Hemisphere + Cone)</span>
                  </div>
                  <div className="mt-2 space-y-1 font-mono text-xs pl-2 text-neutral-700">
                    <p>Base radius r = 3.5 cm = 7/2 cm, Height of cone h = 4 cm</p>
                    <p className="pl-4">Slant height l = √(r² + h²) = √(3.5² + 4²) = √(12.25 + 16) = √28.25 ≈ 5.315 cm</p>
                    <p>Total Surface Area of Toy = CSA of Cone + CSA of Hemisphere</p>
                    <p className="pl-4">TSA = πrl + 2πr² = πr(l + 2r)</p>
                    <p className="pl-4">= (22/7) × (7/2) × (5.315 + 2(3.5)) = 11 × (5.315 + 7) = 11 × 12.315</p>
                    <p className="pl-4 font-bold text-neutral-900">= <span className="underline">135.46 cm²</span></p>
                  </div>
                </div>

                {/* Q6 Section */}
                <div
                  id="doc-section-q6"
                  className={`p-3 rounded-lg transition-all ${
                    selectedQuestionId === "q6" ? "bg-orange-50/40" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-neutral-900 font-mono text-sm">
                    <span className="px-1.5 py-0.5 bg-neutral-200 text-neutral-800 rounded text-xs">
                      Ans 6.
                    </span>
                    <span>Probability of Playing Cards</span>
                  </div>
                  <div className="mt-2 space-y-1 font-mono text-xs pl-2 text-neutral-700">
                    <p>Total number of cards = 52</p>
                    <p>(i) Red face cards = 6 (3 hearts + 3 diamonds) =&gt; P = 6/52 = <span className="font-bold">3/26</span> [✓]</p>
                    <p>(ii) Spades = 13 =&gt; P = 13/52 = <span className="font-bold">1/4</span> [✓]</p>
                    <p>(iii) Neither a king nor a queen:</p>
                    <p className="pl-4">Total Kings = 4, Total Queens = 4 =&gt; Total = 8</p>
                    <p className="pl-4 text-amber-800 bg-amber-100/70 p-0.5 rounded">P = 8/52 = 2/13 (Mistake: Found P(King or Queen) instead of P(Neither))</p>
                  </div>
                </div>
              </div>
            )}

            {/* Interactive Bounding Box Annotation Layer */}
            {showAnnotations && (
              <div className="absolute inset-0 pointer-events-none z-20">
                {pageOverlays.map(({ question: q, box }, idx) => {
                  const isSelected = selectedQuestionId === q.id;
                  const isHovered = hoveredQuestionId === q.id;

                  const borderColor =
                    q.status === "correct"
                      ? "border-emerald-500"
                      : q.status === "partial"
                      ? "border-amber-500"
                      : "border-red-500";

                  const bgColor =
                    q.status === "correct"
                      ? isSelected || isHovered
                        ? "bg-emerald-500/20"
                        : "bg-emerald-500/10"
                      : q.status === "partial"
                      ? isSelected || isHovered
                        ? "bg-amber-500/25"
                        : "bg-amber-500/10"
                      : isSelected || isHovered
                      ? "bg-red-500/20"
                      : "bg-red-500/10";

                  const badgeBg =
                    q.status === "correct"
                      ? "bg-emerald-600 text-white"
                      : q.status === "partial"
                      ? "bg-amber-600 text-white"
                      : "bg-red-600 text-white";

                  return (
                    <div
                      key={`${q.id}-${idx}`}
                      onClick={() => onSelectQuestion(q.id)}
                      onMouseEnter={() => setHoveredQuestionId(q.id)}
                      onMouseLeave={() => setHoveredQuestionId(null)}
                      style={{
                        left: `${box.x}%`,
                        top: `${box.y}%`,
                        width: `${box.width}%`,
                        height: `${box.height}%`,
                      }}
                      className={`absolute rounded-xl border-2 pointer-events-auto cursor-pointer transition-all duration-150 ${borderColor} ${bgColor} ${
                        isSelected
                          ? "ring-4 ring-orange-500/40 shadow-lg scale-[1.005]"
                          : isHovered
                          ? "ring-2 ring-neutral-400/30"
                          : ""
                      }`}
                    >
                      <div className="absolute -top-3.5 left-3 flex items-center gap-1.5 shadow-sm">
                        <span
                          className={`text-[10px] font-sans font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${badgeBg}`}
                        >
                          <span>Q{q.questionNumber}:</span>
                          <span>
                            {q.marksObtained}/{q.maxMarks} M
                          </span>
                        </span>

                        {q.status === "correct" && (
                          <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-emerald-300">
                            100% Match
                          </span>
                        )}
                        {q.status === "partial" && (
                          <span className="bg-amber-100 text-amber-900 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-amber-300">
                            Partial Review
                          </span>
                        )}
                      </div>

                      {(isHovered || isSelected) && (
                        <div className="absolute bottom-2 right-2 max-w-xs bg-neutral-900/90 backdrop-blur-xs text-white p-2 rounded-lg text-[11px] font-sans shadow-xl pointer-events-none animate-in fade-in zoom-in-95">
                          <p className="font-semibold text-orange-300">
                            {q.title}
                          </p>
                          <p className="line-clamp-2 text-neutral-200 mt-0.5">
                            {q.aiRemarks}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
