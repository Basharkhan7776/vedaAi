"use client";

import React, { useState, useRef } from "react";
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
  Sparkles
} from "lucide-react";
import { SidebarNav } from "./sidebar-nav";

// Red PDF Document Badge Icon
function PdfIconBadge() {
  return (
    <div className="w-9 h-11 bg-[#E84338] rounded-lg relative flex flex-col justify-end p-1 shadow-2xs flex-shrink-0 select-none">
      {/* Folded top-right corner */}
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

  // Hidden File Inputs
  const qpInputRef = useRef<HTMLInputElement>(null);
  const asInputRef = useRef<HTMLInputElement>(null);

  // File Upload States
  const [questionPaper, setQuestionPaper] = useState<{
    name: string;
    size: string;
    pages: number;
  } | null>(null);

  const [answerSheets, setAnswerSheets] = useState<{
    name: string;
    size: string;
    studentCount: number;
    pages: number;
  } | null>(null);

  // In-Page Processing / Evaluation State
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationStep, setEvaluationStep] = useState(0);

  const isReady = Boolean(questionPaper && answerSheets);

  const evaluationSteps = [
    "Ingesting & OCR parsing document sheets...",
    "Transcribing handwritten mathematical formulas & steps...",
    "Aligning questions with evaluation rubric criteria...",
    "Generating score breakdowns & spatial bounding box annotations...",
  ];

  // Pre-load sample files matching Figma reference screenshots
  const handleLoadSampleData = () => {
    setQuestionPaper({
      name: "Class_10_maths_unit_test.pdf",
      size: "2MB",
      pages: 2,
    });
    setAnswerSheets({
      name: "student_1_answer_sheet",
      size: "8MB",
      studentCount: 1,
      pages: 6,
    });
  };

  const handleStartEvaluation = () => {
    if (!isReady) return;

    setIsEvaluating(true);
    setEvaluationStep(0);

    setTimeout(() => setEvaluationStep(1), 750);
    setTimeout(() => setEvaluationStep(2), 1500);
    setTimeout(() => setEvaluationStep(3), 2250);
    setTimeout(() => {
      router.push("/analizer");
    }, 3000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "qp" | "as") => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeStr = `${(file.size / (1024 * 1024)).toFixed(1)}MB`;
    if (type === "qp") {
      setQuestionPaper({
        name: file.name,
        size: sizeStr,
        pages: 2,
      });
    } else {
      setAnswerSheets({
        name: file.name,
        size: sizeStr,
        studentCount: 1,
        pages: 6,
      });
    }
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
                    setIsEvaluating(false);
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
                    setIsEvaluating(false);
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
          /* IN-PAGE LOADING SCREEN (Figma Frame 1:9959 with /loading-icon.png) */
          /* ========================================================= */
          <main className="flex-1 max-w-2xl w-full mx-auto p-6 md:p-12 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-300">
            {/* Animated Loading Icon */}
            <div className="relative mb-6 w-28 h-28 sm:w-36 sm:h-36 flex items-center justify-center select-none">
              <div className="absolute inset-0 rounded-full bg-orange-500/15 animate-ping opacity-60" />
              <Image
                src="/loading-icon.png"
                alt="Loading..."
                width={144}
                height={144}
                className="w-full h-full object-contain animate-pulse drop-shadow-sm"
                priority
              />
            </div>

            {/* Title & Subtitle */}
            <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight mb-2">
              Please wait, while we evaluate the answer sheets...
            </h2>
            <p className="text-sm sm:text-base text-neutral-500 max-w-md mx-auto mb-8 font-normal">
              This might take a few moments.
            </p>

            {/* Progress Bar */}
            <div className="w-full max-w-md bg-neutral-100 rounded-full h-2 overflow-hidden mb-4 shadow-inner">
              <div
                className="bg-gradient-to-r from-[#FF5722] to-orange-400 h-full transition-all duration-700 rounded-full"
                style={{ width: `${((evaluationStep + 1) / evaluationSteps.length) * 100}%` }}
              />
            </div>

            {/* Current Step Description */}
            <p className="text-xs text-neutral-400 font-medium tracking-tight">
              {evaluationSteps[evaluationStep]}
            </p>
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
                  if (!questionPaper) {
                    handleLoadSampleData();
                  }
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
                        {questionPaper.size} • {questionPaper.pages} Pages
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
                  if (!answerSheets) {
                    handleLoadSampleData();
                  }
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
                        {answerSheets.size} • {answerSheets.pages} Pages
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

            {/* 4. Action Button ("Start Mapping ->") */}
            <div className="flex flex-col items-center justify-center mt-4 sm:mt-6 space-y-2 sm:space-y-2.5 pb-4">
              <button
                type="button"
                onClick={handleStartEvaluation}
                disabled={!isReady}
                className={`w-full sm:w-auto px-9 py-3 sm:py-3.5 rounded-full text-sm sm:text-base font-medium transition-all flex items-center justify-center gap-2 ${
                  isReady
                    ? "bg-neutral-900 hover:bg-[#FF5722] text-white shadow-md cursor-pointer hover:scale-105"
                    : "bg-[#C5C8CD] text-white cursor-not-allowed opacity-90"
                }`}
              >
                <span>Start Mapping</span>
                <ArrowRight className="w-4 h-4 stroke-[2.2]" />
              </button>

              <p className="text-xs sm:text-sm text-neutral-500 font-normal text-center max-w-md px-2">
                Once both files are uploaded, you'll able to map answers with questions
              </p>
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
