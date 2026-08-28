"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  UploadCloud,
  X,
  ArrowRight,
  Menu,
  Clipboard,
  ArrowLeft,
  CircleHelp,
  Bell,
  ChevronDown,
  Sparkles,
  AlertCircle,
  Loader2,
  Check,
} from "lucide-react";
import { SidebarNav } from "./sidebar-nav";
import { useSessionStatus, useStartEvaluation } from "@/lib/api/hooks";
import { saveClientSession } from "@/lib/session/client-cache";
import type { PipelineProgressEvent, SessionStatus } from "@/lib/types/evaluation";

type UploadMeta = {
  name: string;
  size: string;
  file: File | null;
  demo?: boolean;
};

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

const STAGE_TO_STEP: Record<string, number> = {
  queued: 0,
  ingest_rasterize: 0,
  validate_documents: 1,
  extract_questions: 1,
  thinking_loop: 2,
  map_answers: 2,
  grade_feedback: 3,
  complete: 3,
  failed: 3,
  error: 3,
};

function PdfIconBadge() {
  return (
    <div className="w-9 h-11 bg-[#E84338] rounded-lg relative flex flex-col justify-end p-1 shadow-2xs flex-shrink-0 select-none">
      <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-[#C83025] rounded-bl-sm" />
      <span className="text-[9px] font-black text-white tracking-tighter text-center leading-none mb-1">
        PDF
      </span>
    </div>
  );
}

export function UploadPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const qpInputRef = useRef<HTMLInputElement>(null);
  const asInputRef = useRef<HTMLInputElement>(null);

  const [questionPaper, setQuestionPaper] = useState<UploadMeta | null>(null);
  const [answerSheets, setAnswerSheets] = useState<UploadMeta | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [liveProgress, setLiveProgress] = useState<SessionStatus | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const startMutation = useStartEvaluation();
  const statusQuery = useSessionStatus(activeSessionId, {
    enabled: Boolean(activeSessionId) && !isStreaming,
  });

  const isSubmitting = isStreaming || startMutation.isPending;
  const effectiveStatus = liveProgress || statusQuery.data;
  const isEvaluating = isSubmitting || (Boolean(activeSessionId) && !effectiveStatus?.terminal);
  const currentMilestoneIndex = STAGE_TO_STEP[effectiveStatus?.stage ?? "queued"] ?? 0;
  const rawProgress = effectiveStatus?.progress ?? (isSubmitting ? 15 : 5);
  const progressPercent = Math.min(100, Math.max(5, rawProgress));
  const statusLabel =
    effectiveStatus?.stageLabel ||
    "Please wait, while we evaluate the answer sheets...";

  const isReady = Boolean(questionPaper && answerSheets);

  // When Gemini pipeline finishes in legacy fallback mode, open analyzer with session
  useEffect(() => {
    if (isStreaming) return;
    const status = statusQuery.data;
    if (!activeSessionId || !status?.terminal) return;
    sessionStorage.setItem("veda-session-id", activeSessionId);
    router.push(`/analizer?session=${activeSessionId}`);
  }, [activeSessionId, statusQuery.data, router, isStreaming]);

  const handleLoadSampleData = async () => {
    setEvalError(null);
    try {
      const [qpRes, asRes] = await Promise.all([
        fetch("/sample/question.pdf"),
        fetch("/sample/answer.pdf"),
      ]);
      if (!qpRes.ok || !asRes.ok) {
        throw new Error("Sample PDFs not found in /public/sample");
      }
      const qpBlob = await qpRes.blob();
      const asBlob = await asRes.blob();
      const qpFile = new File([qpBlob], "question.pdf", {
        type: "application/pdf",
      });
      const asFile = new File([asBlob], "answer.pdf", {
        type: "application/pdf",
      });
      setQuestionPaper({
        name: qpFile.name,
        size: formatSize(qpFile.size),
        file: qpFile,
      });
      setAnswerSheets({
        name: asFile.name,
        size: formatSize(asFile.size),
        file: asFile,
      });
    } catch (err) {
      setEvalError(
        err instanceof Error
          ? err.message
          : "Could not load sample question/answer PDFs",
      );
    }
  };

  const handleStartEvaluation = async () => {
    setEvalError(null);
    if (!questionPaper || !answerSheets) return;

    const useDemo =
      questionPaper.demo ||
      answerSheets.demo ||
      !questionPaper.file ||
      !answerSheets.file;

    try {
      let qpFile = questionPaper.file;
      let asFile = answerSheets.file;

      if (useDemo) {
        qpFile =
          qpFile ||
          new File([new Uint8Array([37, 80, 68, 70])], "demo-qp.pdf", {
            type: "application/pdf",
          });
        asFile =
          asFile ||
          new File([new Uint8Array([37, 80, 68, 70])], "demo-ans.pdf", {
            type: "application/pdf",
          });
      }

      setIsStreaming(true);
      setLiveProgress({
        id: "init",
        stage: "queued",
        stageIndex: 0,
        stageLabel: "Preparing evaluation…",
        progress: 5,
        ready: false,
        terminal: false,
      });

      const formData = new FormData();
      formData.append("questionPaper", qpFile!);
      formData.append("answerSheet", asFile!);
      formData.append("stream", "true");
      if (useDemo && !questionPaper.file) formData.append("demo", "true");

      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: {
          Accept: "application/x-ndjson",
        },
        body: formData,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Upload failed (${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("ReadableStream not supported by response");

      const decoder = new TextDecoder();
      let buffer = "";
      let finalSessionId: string | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line) as PipelineProgressEvent;
            if (event.sessionId) {
              finalSessionId = event.sessionId;
              setActiveSessionId(finalSessionId);
            }

            if (event.type === "stage") {
              setLiveProgress({
                id: event.sessionId || finalSessionId || "session",
                stage: event.stage || "queued",
                stageIndex: event.stageIndex || 0,
                stageLabel: event.stageLabel || "Processing…",
                progress: event.progress || 10,
                ready: false,
                terminal: false,
              });
            } else if (event.type === "complete") {
              setLiveProgress({
                id: event.sessionId || finalSessionId || "session",
                stage: "complete",
                stageIndex: 7,
                stageLabel: "Evaluation complete",
                progress: 100,
                ready: true,
                terminal: true,
              });
              if (event.sessionId) {
                await saveClientSession(event.sessionId, {
                  ok: true,
                  evaluation: event.evaluation,
                  pageImages: event.pageImages,
                  hasPageImages: Boolean(event.pageImages?.length),
                });
              }
              setIsStreaming(false);
              router.push(`/analizer?session=${event.sessionId || finalSessionId}`);
              return;
            } else if (event.type === "failure") {
              setLiveProgress({
                id: event.sessionId || finalSessionId || "session",
                stage: "failed",
                stageIndex: 7,
                stageLabel: event.stageLabel || "Documents could not be mapped",
                progress: 100,
                ready: false,
                terminal: true,
              });
              if (event.sessionId) {
                await saveClientSession(event.sessionId, {
                  ok: false,
                  failure: event.failure,
                  hasPageImages: false,
                });
              }
              setIsStreaming(false);
              router.push(`/analizer?session=${event.sessionId || finalSessionId}`);
              return;
            } else if (event.type === "error") {
              const errMsg = event.error || "Evaluation pipeline error";
              setEvalError(errMsg);
              setIsStreaming(false);
              setLiveProgress(null);
              return;
            }
          } catch (parseErr) {
            console.error("Stream parse error:", parseErr, line);
          }
        }
      }
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : "Failed to start evaluation");
      setIsStreaming(false);
      setActiveSessionId(null);
      setLiveProgress(null);
    }
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "qp" | "as",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const meta: UploadMeta = {
      name: file.name,
      size: formatSize(file.size),
      file,
      demo: false,
    };
    if (type === "qp") setQuestionPaper(meta);
    else setAnswerSheets(meta);
  };

  return (
    <div className="flex h-screen w-full bg-[#EBEBE8] p-2 md:p-3.5 gap-3 overflow-hidden text-neutral-900 font-sans">
      {/* Hidden file pickers */}
      <input
        type="file"
        ref={qpInputRef}
        onChange={(e) => handleFileChange(e, "qp")}
        accept=".pdf,.png,.jpg,.jpeg"
        className="hidden"
      />
      <input
        type="file"
        ref={asInputRef}
        onChange={(e) => handleFileChange(e, "as")}
        accept=".pdf,.png,.jpg,.jpeg"
        className="hidden"
      />

      {/* Desktop Sidebar */}
      <div className="hidden md:flex h-full flex-shrink-0">
        <SidebarNav
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-neutral-900/50 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 w-72 bg-white h-full shadow-2xl p-3">
            <SidebarNav
              isOpen={true}
              onCloseMobile={() => setMobileMenuOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main App Floating Canvas Card with minute soft grey gradient */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-white bg-gradient-to-t from-neutral-200/40 via-neutral-100/15 to-white rounded-2xl md:rounded-3xl border border-neutral-200/80 shadow-sm overflow-hidden">
        {/* Top App Header */}
        <header className="h-16 px-4 md:px-8 border-b border-neutral-100 flex items-center justify-between flex-shrink-0 select-none">
          {/* 1. MOBILE TOP BAR (Exact match with reference image) */}
          <div className="flex md:hidden items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                onClick={(e) => {
                  if (isEvaluating) {
                    e.preventDefault();
                    setActiveSessionId(null);
                  }
                }}
                className="text-neutral-900 hover:text-neutral-600 transition-colors p-1 -ml-1"
                title="Back"
              >
                <ArrowLeft className="w-6 h-6 stroke-[2.5]" />
              </Link>
              <span className="font-extrabold text-xl text-neutral-900 tracking-tight font-sans">
                VedaAI
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="relative w-10 h-10 rounded-full bg-[#F5F5F3] hover:bg-neutral-200/80 flex items-center justify-center text-neutral-800 transition-colors cursor-pointer"
                title="Notifications"
              >
                <Bell className="w-5 h-5 stroke-[2]" />
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-[#F95738] ring-2 ring-white" />
              </button>

              <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 shadow-2xs border border-neutral-200/80">
                <Image
                  src="/profile.png"
                  alt="User Profile"
                  width={40}
                  height={40}
                  className="w-full h-full object-cover"
                />
              </div>

              <button
                onClick={() => setMobileMenuOpen(true)}
                className="p-1.5 text-neutral-900 hover:text-neutral-600 transition-colors"
                title="Open Menu"
              >
                <Menu className="w-6 h-6 stroke-[2.5]" />
              </button>
            </div>
          </div>

          {/* 2. DESKTOP TOP BAR */}
          <div className="hidden md:flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                onClick={(e) => {
                  if (isEvaluating) {
                    e.preventDefault();
                    setActiveSessionId(null);
                  }
                }}
                className="w-9 h-9 rounded-full bg-white hover:bg-neutral-50 flex items-center justify-center text-neutral-800 transition-colors shadow-2xs border border-neutral-200/80 cursor-pointer"
                title="Back"
              >
                <ArrowLeft className="w-4 h-4 stroke-[2]" />
              </Link>

              <div className="flex items-center gap-2 text-neutral-400 font-medium text-base ml-1">
                <Clipboard className="w-5 h-5 stroke-[1.8]" />
                <span className="tracking-tight text-neutral-400">Exams</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="w-9 h-9 rounded-full bg-[#F5F5F3] hover:bg-neutral-200/70 flex items-center justify-center text-neutral-700 transition-colors cursor-pointer"
                title="Help"
              >
                <CircleHelp className="w-5 h-5 stroke-[1.8]" />
              </button>

              <button
                type="button"
                className="relative w-9 h-9 rounded-full bg-[#F5F5F3] hover:bg-neutral-200/70 flex items-center justify-center text-neutral-700 transition-colors cursor-pointer"
                title="Notifications"
              >
                <Bell className="w-5 h-5 stroke-[1.8]" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#F95738] ring-2 ring-white" />
              </button>

              <button
                type="button"
                className="w-9 h-9 rounded-full bg-[#F5F5F3] hover:bg-neutral-200/70 flex items-center justify-center text-neutral-700 transition-colors cursor-pointer"
                title="AI Assistant"
              >
                <Sparkles className="w-4 h-4 fill-neutral-700 text-neutral-700" />
              </button>

              <div className="flex items-center gap-2.5 pl-1 pr-1.5 py-1 rounded-full hover:bg-neutral-100/80 transition-colors cursor-pointer select-none">
                <div className="w-8 h-8 rounded-full overflow-hidden border border-neutral-200 shadow-2xs relative flex-shrink-0">
                  <Image
                    src="/profile.png"
                    alt="Madhur Rastogi"
                    width={32}
                    height={32}
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="text-sm font-semibold text-neutral-800 tracking-tight">
                  Madhur Rastogi
                </span>
                <ChevronDown className="w-4 h-4 text-neutral-500 stroke-[2]" />
              </div>
            </div>
          </div>
        </header>

        {/* Conditional Rendering: In-Page Loading Screen VS Upload Screen */}
        {isEvaluating ? (
          /* ========================================================= */
          /* IN-PAGE LOADING SCREEN (Figma Exact Match + Sleek Bar)   */
          /* ========================================================= */
          <main className="flex-1 w-full mx-auto flex flex-col items-center justify-center text-center select-none animate-in fade-in zoom-in-95 duration-300">
            <div className="relative mb-6 w-28 h-28 sm:w-36 sm:h-36 flex items-center justify-center">
              <Image
                src="/loading-icon.png"
                alt="Extracting..."
                width={144}
                height={144}
                className="w-full h-full object-contain animate-pulse drop-shadow-xs"
                priority
              />
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight mb-2 font-sans">
              Extracting...
            </h2>
            <p className="text-sm sm:text-base text-neutral-500 font-normal tracking-tight mb-6">
              This may take a while
            </p>

            {/* Unlabeled Minimalist Progress Bar */}
            <div className="w-64 sm:w-80 max-w-xs bg-neutral-100 rounded-full h-2 overflow-hidden shadow-inner border border-neutral-200/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#FF5722] to-orange-400 transition-all duration-700 ease-out relative overflow-hidden"
                style={{ width: `${progressPercent}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
              </div>
            </div>
          </main>
        ) : (
          /* ========================================================= */
          /* NORMAL UPLOAD VIEW                                        */
          /* ========================================================= */
          <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 md:p-8 flex flex-col justify-start md:justify-center overflow-y-auto">
            {/* 1. Header Title & Subtitle */}
            <div className="text-center max-w-4xl mx-auto mb-2 space-y-1 sm:space-y-2">
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-neutral-900 tracking-tight flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
                <span>Upload</span>
                <span className="bg-[#FFF0EB] text-[#FF5722] px-3 sm:px-4 py-0.5 sm:py-1 rounded-xl sm:rounded-2xl inline-flex items-center">
                  <span className="underline decoration-[#FF5722] decoration-2 underline-offset-4">
                    Question
                  </span>
                  <span className="mx-1.5 sm:mx-2">&</span>
                  <span>Answer Sheets</span>
                </span>
              </h1>

              <p className="text-sm sm:text-base md:text-lg text-neutral-700 font-normal pt-0.5 sm:pt-1">
                Upload both files to get started
              </p>
            </div>

            {/* 2. Middle Character Hero Image */}
            <div className="relative mx-auto my-2 sm:my-3 w-36 h-36 sm:w-48 sm:h-48 md:w-52 md:h-52 flex items-center justify-center select-none pointer-events-none">
              <Image
                src="/hero.png"
                alt="Veda AI Teacher"
                width={220}
                height={220}
                className="w-full h-full object-contain"
                priority
              />
            </div>

            {/* 3. Dual Upload Cards (Dashed Borders) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 max-w-4xl w-full mx-auto my-2 sm:my-3">
              {/* Card 1: Upload Question Paper */}
              <div
                onClick={() => {
                  if (!questionPaper) qpInputRef.current?.click();
                }}
                className="border-2 border-dashed border-neutral-300 hover:border-neutral-400 bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-center flex items-center justify-center transition-all cursor-pointer min-h-[170px] sm:min-h-[200px]"
              >
                {questionPaper ? (
                  /* Uploaded File Pill Card */
                  <div className="relative bg-[#F5F5F5] rounded-2xl px-5 py-3.5 flex items-center gap-3.5 shadow-2xs max-w-xs sm:max-w-sm w-full animate-in fade-in zoom-in-95">
                    <PdfIconBadge />

                    <div className="text-left min-w-0 pr-3">
                      <p className="text-sm font-bold text-neutral-900 truncate">
                        {questionPaper.name}
                      </p>
                      <p className="text-xs text-neutral-500 font-normal mt-0.5">
                        {questionPaper.size}
                        {questionPaper.demo ? " • Sample" : ""}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setQuestionPaper(null);
                      }}
                      className="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full bg-[#4A4D52] hover:bg-[#333] text-white flex items-center justify-center shadow-xs transition-transform hover:scale-110 cursor-pointer"
                      title="Remove file"
                    >
                      <X className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-[#F0F0EE] flex items-center justify-center text-neutral-800 mb-3 sm:mb-4 shadow-2xs">
                      <UploadCloud className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
                    </div>
                    <p className="text-sm sm:text-base md:text-lg font-bold text-neutral-900 tracking-tight">
                      Upload{" "}
                      <span className="text-[#FF5722] underline decoration-[#FF5722] underline-offset-2">
                        Question Paper
                      </span>
                    </p>
                    <p className="text-[11px] sm:text-xs text-neutral-400 font-normal mt-1 sm:mt-1.5">
                      Max 10MB
                    </p>
                  </div>
                )}
              </div>

              {/* Card 2: Upload Answer Sheet */}
              <div
                onClick={() => {
                  if (!answerSheets) asInputRef.current?.click();
                }}
                className="border-2 border-dashed border-neutral-300 hover:border-neutral-400 bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-center flex items-center justify-center transition-all cursor-pointer min-h-[170px] sm:min-h-[200px]"
              >
                {answerSheets ? (
                  /* Uploaded File Pill Card */
                  <div className="relative bg-[#F5F5F5] rounded-2xl px-5 py-3.5 flex items-center gap-3.5 shadow-2xs max-w-xs sm:max-w-sm w-full animate-in fade-in zoom-in-95">
                    <PdfIconBadge />

                    <div className="text-left min-w-0 pr-3">
                      <p className="text-sm font-bold text-neutral-900 truncate">
                        {answerSheets.name}
                      </p>
                      <p className="text-xs text-neutral-500 font-normal mt-0.5">
                        {answerSheets.size}
                        {answerSheets.demo ? " • Sample" : ""}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAnswerSheets(null);
                      }}
                      className="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full bg-[#4A4D52] hover:bg-[#333] text-white flex items-center justify-center shadow-xs transition-transform hover:scale-110 cursor-pointer"
                      title="Remove file"
                    >
                      <X className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-[#F0F0EE] flex items-center justify-center text-neutral-800 mb-3 sm:mb-4 shadow-2xs">
                      <UploadCloud className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
                    </div>
                    <p className="text-sm sm:text-base md:text-lg font-bold text-neutral-900 tracking-tight">
                      Upload{" "}
                      <span className="text-[#FF5722]">Answer Sheet</span>
                    </p>
                    <p className="text-[11px] sm:text-xs text-neutral-400 font-normal mt-1 sm:mt-1.5">
                      Max 10MB
                    </p>
                  </div>
                )}
              </div>
            </div>

            {evalError && (
              <div className="max-w-4xl w-full mx-auto mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <p>{evalError}</p>
              </div>
            )}

            {/* 4. Action Button ("Start Mapping ->") */}
            <div className="flex flex-col items-center justify-center mt-4 sm:mt-6 space-y-2 sm:space-y-2.5 pb-4">
              <button
                type="button"
                onClick={handleStartEvaluation}
                disabled={!isReady || isSubmitting}
                className={`w-full sm:w-auto px-9 py-3 sm:py-3.5 rounded-full text-sm sm:text-base font-semibold transition-all flex items-center justify-center gap-2.5 ${
                  isSubmitting
                    ? "bg-neutral-800 text-white cursor-wait opacity-90 shadow-md"
                    : isReady
                      ? "bg-neutral-900 hover:bg-[#FF5722] text-white shadow-md cursor-pointer hover:scale-105 active:scale-95"
                      : "bg-[#C5C8CD] text-white cursor-not-allowed opacity-90"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#FF5722]" />
                    <span>Loading...</span>
                  </>
                ) : (
                  <>
                    <span>Start Mapping</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.2]" />
                  </>
                )}
              </button>

              <p className="text-xs sm:text-sm text-neutral-500 font-normal text-center max-w-md px-2">
                Once both files are uploaded, you&apos;ll able to map answers with
                questions
              </p>

              {!isReady && (
                <button
                  type="button"
                  onClick={handleLoadSampleData}
                  className="text-xs font-semibold text-[#FF5722] underline underline-offset-2"
                >
                  Load sample files
                </button>
              )}
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
