"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  UploadCloud,
  FileText,
  Files,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
  Menu,
  BookOpen,
  GraduationCap,
  Layers,
  FileCheck,
  Zap,
  Info,
  Clock
} from "lucide-react";
import { SidebarNav } from "./sidebar-nav";
import { SAMPLE_EVALUATION } from "./mock-data";

type UploadMeta = {
  name: string;
  size: string;
  pages: number;
  file: File | null;
  demo?: boolean;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STAGE_TO_STEP: Record<string, number> = {
  queued: 0,
  ingest_rasterize: 0,
  extract_questions: 1,
  map_answers: 2,
  grade_feedback: 3,
  complete: 3,
  error: 0,
};

export function UploadPage() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const questionInputRef = React.useRef<HTMLInputElement>(null);
  const answerInputRef = React.useRef<HTMLInputElement>(null);

  const [questionPaper, setQuestionPaper] = useState<UploadMeta | null>(null);
  const [answerSheets, setAnswerSheets] = useState<UploadMeta | null>(null);

  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationStep, setEvaluationStep] = useState(0);
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);

  const evaluationSteps = [
    "Ingesting & rendering answer sheet pages…",
    "Extracting questions from the question paper…",
    "Mapping handwritten answers + bounding boxes…",
    "Scoring answers & generating AI feedback…",
  ];

  const handleLoadSampleData = () => {
    setQuestionPaper({
      name: "CBSE_Class10_Mathematics_MidTerm_2026.pdf",
      size: "2.4 MB",
      pages: 4,
      file: null,
      demo: true,
    });
    setAnswerSheets({
      name: "Aarav_Sharma_Roll104_AnswerSheet.pdf",
      size: "4.8 MB",
      pages: 2,
      file: null,
      demo: true,
    });
    setEvalError(null);
  };

  const onPickQuestion = (file: File | null) => {
    if (!file) return;
    setQuestionPaper({
      name: file.name,
      size: formatBytes(file.size),
      pages: 1,
      file,
      demo: false,
    });
  };

  const onPickAnswer = (file: File | null) => {
    if (!file) return;
    setAnswerSheets({
      name: file.name,
      size: formatBytes(file.size),
      pages: 1,
      file,
      demo: false,
    });
  };

  const pollUntilReady = async (sessionId: string) => {
    for (;;) {
      const res = await fetch(`/api/sessions/${sessionId}/status`);
      if (!res.ok) throw new Error("Failed to read evaluation status");
      const status = await res.json();
      setStatusLabel(status.stageLabel);
      setEvaluationStep(STAGE_TO_STEP[status.stage] ?? 0);

      if (status.stage === "error") {
        throw new Error(status.error || status.stageLabel || "Evaluation failed");
      }
      if (status.ready || status.stage === "complete") {
        return;
      }
      await new Promise((r) => setTimeout(r, 700));
    }
  };

  const handleStartEvaluation = async () => {
    setEvalError(null);

    const useDemo =
      !questionPaper?.file ||
      !answerSheets?.file ||
      questionPaper.demo ||
      answerSheets.demo;

    if (!questionPaper || !answerSheets) {
      handleLoadSampleData();
    }

    setIsEvaluating(true);
    setEvaluationStep(0);
    setStatusLabel(evaluationSteps[0]);

    try {
      const form = new FormData();
      if (useDemo) {
        form.append("demo", "true");
        form.append(
          "questionPaper",
          new File([new Uint8Array([37, 80, 68, 70])], "demo-qp.pdf", {
            type: "application/pdf",
          }),
        );
        form.append(
          "answerSheet",
          new File([new Uint8Array([37, 80, 68, 70])], "demo-ans.pdf", {
            type: "application/pdf",
          }),
        );
      } else {
        form.append("questionPaper", questionPaper!.file!);
        form.append("answerSheet", answerSheets!.file!);
      }

      const start = await fetch("/api/evaluate", { method: "POST", body: form });
      const body = await start.json();
      if (!start.ok) throw new Error(body.error || "Failed to start evaluation");

      const sessionId = body.sessionId as string;
      await pollUntilReady(sessionId);

      if (typeof window !== "undefined") {
        sessionStorage.setItem("veda-session-id", sessionId);
      }
      router.push(`/analizer?session=${sessionId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Evaluation failed";
      setEvalError(message);
      setIsEvaluating(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#FBFBFA] overflow-hidden text-neutral-900">
      {/* Desktop Sidebar Navigation */}
      <div className="hidden md:block h-full flex-shrink-0">
        <SidebarNav />
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-neutral-900/50 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 w-72 bg-white h-full shadow-2xl">
            <SidebarNav onCloseMobile={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* Main App Canvas */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-y-auto">
        {/* Top App Header */}
        <header className="h-16 px-4 md:px-8 border-b border-neutral-200/80 bg-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -ml-2 text-neutral-600 hover:text-neutral-900 md:hidden rounded-lg hover:bg-neutral-100"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-sm text-neutral-500 font-medium">
              <span className="text-neutral-900 font-semibold">Veda AI</span>
              <span>/</span>
              <span className="text-orange-700 bg-orange-50 px-2 py-0.5 rounded-md text-xs font-semibold">
                Evaluation Studio
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleLoadSampleData}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-neutral-700 bg-neutral-100 hover:bg-neutral-200/80 transition-colors flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
              <span>Load Sample Files</span>
            </button>

            <div className="w-8 h-8 rounded-full bg-orange-100 border border-orange-200 text-orange-700 font-bold text-xs flex items-center justify-center">
              BK
            </div>
          </div>
        </header>

        {/* Page Main Content Area */}
        <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8 flex flex-col justify-center">
          {/* Hero Section */}
          <div className="text-center max-w-2xl mx-auto mb-8 space-y-2.5">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-orange-500 via-orange-400 to-amber-300 text-white shadow-lg shadow-orange-500/20 mb-2">
              <Sparkles className="w-7 h-7 fill-white/80" />
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold text-neutral-900 tracking-tight">
              Upload Question Paper & Answer Sheets
            </h1>

            <p className="text-sm md:text-base text-neutral-600 max-w-lg mx-auto">
              Upload your assessment question paper alongside student response sheets.
              Veda AI extracts handwritten solutions, aligns step rubrics, and grades with explainable annotations.
            </p>
          </div>

          {/* Dual Dropzone Cards (Figma Clone) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
            {/* Card 1: Question Paper Upload */}
            <div className="bg-white rounded-2xl border-2 border-neutral-200/90 hover:border-orange-300 transition-all p-6 flex flex-col justify-between shadow-xs hover:shadow-md group">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <FileText className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                    Step 1
                  </span>
                </div>

                <h3 className="text-base font-bold text-neutral-900 mb-1">
                  Question Paper
                </h3>
                <p className="text-xs text-neutral-500 mb-5">
                  Upload exam paper, answer key, or rubric criteria (PDF, DOCX, PNG).
                </p>

                <input
                  ref={questionInputRef}
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => onPickQuestion(e.target.files?.[0] ?? null)}
                />

                {questionPaper ? (
                  <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
                        <FileCheck className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-neutral-900 truncate">
                          {questionPaper.name}
                        </p>
                        <p className="text-[11px] text-emerald-800 font-medium">
                          {questionPaper.demo ? "Demo sample" : "Ready"} •{" "}
                          {questionPaper.size}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setQuestionPaper(null)}
                      className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-emerald-100"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => questionInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      onPickQuestion(e.dataTransfer.files?.[0] ?? null);
                    }}
                    className="border-2 border-dashed border-neutral-300 hover:border-orange-500 rounded-xl p-6 text-center cursor-pointer bg-neutral-50/50 hover:bg-orange-50/30 transition-colors"
                  >
                    <UploadCloud className="w-8 h-8 text-neutral-400 mx-auto mb-2 group-hover:text-orange-500 transition-colors" />
                    <p className="text-xs font-semibold text-neutral-700">
                      Click to upload or drag & drop
                    </p>
                    <p className="text-[11px] text-neutral-400 mt-1">
                      PDF, JPG or PNG (up to 25MB)
                    </p>
                  </div>
                )}
              </div>

              {!questionPaper && (
                <button
                  type="button"
                  onClick={handleLoadSampleData}
                  className="mt-4 w-full py-2 px-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5 text-orange-600" />
                  <span>Use Sample Question Paper</span>
                </button>
              )}
            </div>

            {/* Card 2: Student Answer Sheets Upload */}
            <div className="bg-white rounded-2xl border-2 border-neutral-200/90 hover:border-orange-300 transition-all p-6 flex flex-col justify-between shadow-xs hover:shadow-md group">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Files className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                    Step 2
                  </span>
                </div>

                <h3 className="text-base font-bold text-neutral-900 mb-1">
                  Student Answer Sheets
                </h3>
                <p className="text-xs text-neutral-500 mb-5">
                  Upload scanned copies of handwritten student answer booklets.
                </p>

                <input
                  ref={answerInputRef}
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => onPickAnswer(e.target.files?.[0] ?? null)}
                />

                {answerSheets ? (
                  <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
                        <FileCheck className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-neutral-900 truncate">
                          {answerSheets.name}
                        </p>
                        <p className="text-[11px] text-emerald-800 font-medium">
                          {answerSheets.demo ? "Demo sample" : "1 student sheet"} •{" "}
                          {answerSheets.size}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setAnswerSheets(null)}
                      className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-emerald-100"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => answerInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      onPickAnswer(e.dataTransfer.files?.[0] ?? null);
                    }}
                    className="border-2 border-dashed border-neutral-300 hover:border-orange-500 rounded-xl p-6 text-center cursor-pointer bg-neutral-50/50 hover:bg-orange-50/30 transition-colors"
                  >
                    <UploadCloud className="w-8 h-8 text-neutral-400 mx-auto mb-2 group-hover:text-orange-500 transition-colors" />
                    <p className="text-xs font-semibold text-neutral-700">
                      Click to upload or drag & drop
                    </p>
                    <p className="text-[11px] text-neutral-400 mt-1">
                      Scanned PDF or image (one student)
                    </p>
                  </div>
                )}
              </div>

              {!answerSheets && (
                <button
                  type="button"
                  onClick={handleLoadSampleData}
                  className="mt-4 w-full py-2 px-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5 text-orange-600" />
                  <span>Use Sample Student Submission</span>
                </button>
              )}
            </div>
          </div>

          {evalError && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p>{evalError}</p>
            </div>
          )}

          {/* Bottom Action Section */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              type="button"
              onClick={handleStartEvaluation}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-neutral-950 via-neutral-900 to-neutral-800 hover:from-orange-600 hover:to-orange-500 text-white font-bold text-sm transition-all shadow-lg shadow-neutral-900/10 hover:shadow-orange-500/25 flex items-center justify-center gap-2 group cursor-pointer"
            >
              <Sparkles className="w-4 h-4 fill-white/80 group-hover:rotate-12 transition-transform" />
              <span>Start AI Evaluation</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Quick Features Highlight */}
          <div className="mt-12 pt-6 border-t border-neutral-200/80 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center mb-2 font-bold text-xs">
                1
              </div>
              <h4 className="text-xs font-bold text-neutral-800">Handwriting Recognition</h4>
              <p className="text-[11px] text-neutral-500 mt-0.5">Accurate OCR for complex formulas & diagrams</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center mb-2 font-bold text-xs">
                2
              </div>
              <h4 className="text-xs font-bold text-neutral-800">Step-by-Step Rubric</h4>
              <p className="text-[11px] text-neutral-500 mt-0.5">Partial marking based on exact marking scheme</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center mb-2 font-bold text-xs">
                3
              </div>
              <h4 className="text-xs font-bold text-neutral-800">Visual Bounding Boxes</h4>
              <p className="text-[11px] text-neutral-500 mt-0.5">Interactive overlays mapped to each answer on sheet</p>
            </div>
          </div>
        </main>
      </div>

      {/* Evaluation Processing Modal (Figma Screen 3 Clone) */}
      {isEvaluating && (
        <div className="fixed inset-0 z-50 bg-neutral-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl border border-neutral-200 animate-in fade-in zoom-in-95 space-y-6">
            <div className="relative mx-auto w-20 h-20">
              <div className="absolute inset-0 rounded-full bg-orange-500/20 animate-ping" />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-orange-600 to-amber-400 text-white flex items-center justify-center shadow-lg shadow-orange-500/30">
                <Sparkles className="w-10 h-10 fill-white/80 animate-pulse" />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-neutral-900">
                Evaluating Responses...
              </h3>
              <p className="text-xs text-neutral-500 font-medium">
                {statusLabel ||
                  "Veda AI is analyzing question papers and handwritten solutions."}
              </p>
            </div>

            {/* Step Progress Checklist */}
            <div className="space-y-2.5 text-left bg-neutral-50 p-4 rounded-2xl border border-neutral-200/70">
              {evaluationSteps.map((step, idx) => {
                const isCompleted = idx < evaluationStep;
                const isCurrent = idx === evaluationStep;

                return (
                  <div
                    key={step}
                    className={`flex items-center gap-2.5 text-xs transition-opacity duration-300 ${
                      isCompleted
                        ? "text-emerald-700 font-medium"
                        : isCurrent
                        ? "text-neutral-900 font-bold"
                        : "text-neutral-400 opacity-60"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    ) : isCurrent ? (
                      <div className="w-4 h-4 rounded-full border-2 border-orange-500 border-t-transparent animate-spin flex-shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-neutral-300 flex-shrink-0" />
                    )}
                    <span className="truncate">{step}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
