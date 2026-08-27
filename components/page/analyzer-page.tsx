"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Clipboard,
  CircleHelp,
  Bell,
  ChevronDown,
  Sparkles,
  Menu,
  AlertTriangle,
  FileWarning,
  Lightbulb,
  RefreshCw,
} from "lucide-react";
import { SidebarNav } from "./sidebar-nav";
import { DocumentViewer } from "./document-viewer";
import { QuestionCard } from "./question-card";
import { SAMPLE_EVALUATION, EvaluationSession } from "./mock-data";
import { useEvaluationSession } from "@/lib/api/hooks";
import { sessionPageUrl } from "@/lib/api/evaluation";
import type { SessionFailure } from "@/lib/types/evaluation";

export function AnalyzerPage() {
  const searchParams = useSearchParams();
  const sessionIdFromQuery = searchParams.get("session");
  const sessionId = useMemo(() => {
    if (sessionIdFromQuery) return sessionIdFromQuery;
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("veda-session-id");
    }
    return null;
  }, [sessionIdFromQuery]);

  const sessionQuery = useEvaluationSession(sessionId, {
    enabled: Boolean(sessionId),
  });

  const [selectedQuestionId, setSelectedQuestionId] = useState<string>("q1");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileActiveTab, setMobileActiveTab] = useState<
    "questions" | "document"
  >("questions");
  const [expandAll, setExpandAll] = useState(false);

  const isDemoBrowse = !sessionId;
  const payload = sessionQuery.data;
  const evaluation: EvaluationSession | null = isDemoBrowse
    ? SAMPLE_EVALUATION
    : payload && payload.ok
      ? (payload.evaluation as EvaluationSession)
      : null;
  const failure: SessionFailure | null =
    !isDemoBrowse && payload && !payload.ok && payload.failure
      ? payload.failure
      : null;
  const hasPageImages =
    !isDemoBrowse && payload && "hasPageImages" in payload
      ? Boolean(payload.hasPageImages)
      : false;
  const isLoading =
    Boolean(sessionId) &&
    (sessionQuery.isLoading ||
      (payload && !payload.ok && "pending" in payload && payload.pending) ||
      (payload && !payload.ok && !payload.failure && !payload.status?.terminal));

  useEffect(() => {
    if (!evaluation?.questions?.length) return;
    setSelectedQuestionId((prev) => {
      if (evaluation.questions.some((q) => q.id === prev)) return prev;
      return evaluation.questions[0].id;
    });
    setCurrentPage(evaluation.questions[0].page || 1);
  }, [evaluation]);

  const handleSelectQuestion = (qId: string) => {
    if (!evaluation) return;
    setSelectedQuestionId(qId);
    const targetQ = evaluation.questions.find((q) => q.id === qId);
    if (targetQ) {
      const page = targetQ.regions?.[0]?.page ?? targetQ.page ?? currentPage;
      if (page !== currentPage) setCurrentPage(page);
      setMobileActiveTab("document");
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#EBEBE8] p-2 md:p-3.5 gap-3 overflow-hidden text-neutral-900 font-sans">
      <div className="hidden md:flex h-full flex-shrink-0 transition-all duration-300">
        <SidebarNav
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />
      </div>

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

      <div className="flex-1 flex flex-col h-full min-w-0 bg-white bg-gradient-to-t from-neutral-200/40 via-neutral-100/15 to-white rounded-2xl md:rounded-3xl border border-neutral-200/80 shadow-sm overflow-hidden">
        <header className="h-16 px-4 md:px-8 border-b border-neutral-100 flex items-center justify-between flex-shrink-0 select-none">
          <div className="flex md:hidden items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="text-neutral-900 hover:text-neutral-600 transition-colors p-1 -ml-1"
                title="Back to Upload"
              >
                <ArrowLeft className="w-6 h-6 stroke-[2.5]" />
              </Link>
              <span className="font-extrabold text-xl text-neutral-900 tracking-tight font-sans">
                VedaAI
              </span>
            </div>
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 text-neutral-700 hover:bg-neutral-100 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          <div className="hidden md:flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="p-2 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-neutral-700"
                title="Back to Upload"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <Clipboard className="w-4 h-4" />
                <span>Exams</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="w-9 h-9 rounded-xl bg-neutral-100 flex items-center justify-center">
                <CircleHelp className="w-4 h-4" />
              </button>
              <button className="relative w-9 h-9 rounded-xl bg-neutral-100 flex items-center justify-center">
                <Bell className="w-4 h-4" />
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#FF5722]" />
              </button>
              <div className="flex items-center gap-2 pl-1">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-neutral-200 relative">
                  <Image
                    src="/profile.png"
                    alt="Profile"
                    fill
                    sizes="32px"
                    className="object-cover"
                  />
                </div>
                <span className="text-sm font-semibold">Madhur Rastogi</span>
              </div>
            </div>
          </div>
        </header>

        {isDemoBrowse && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-900 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5" />
            Showing sample demo data. Upload files and Start Mapping to load
            contextual Gemini results.
          </div>
        )}

        {isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="relative mb-5 w-24 h-24">
              <div className="absolute inset-0 rounded-full bg-orange-500/15 animate-ping" />
              <Image
                src="/loading-icon.png"
                alt="Loading"
                width={96}
                height={96}
                className="relative w-full h-full object-contain animate-pulse"
              />
            </div>
            <h2 className="text-xl font-extrabold text-neutral-900">
              Analyzing your sheets...
            </h2>
            <p className="text-sm text-neutral-500 mt-1">
              Loading contextual AI results for this session
            </p>
          </div>
        )}

        {!isLoading && failure && (
          <FailedPanel failure={failure} sessionId={sessionId} hasPageImages={hasPageImages} />
        )}

        {!isLoading && !failure && evaluation && (
          <>
            <div className="flex md:hidden bg-neutral-100/80 p-1 rounded-full mx-4 my-2.5 shadow-2xs border border-neutral-200/60">
              <button
                onClick={() => setMobileActiveTab("questions")}
                className={`flex-1 py-2 text-xs font-bold rounded-full transition-all flex items-center justify-center ${
                  mobileActiveTab === "questions"
                    ? "bg-[#292A2D] text-white shadow-xs"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                <span>Questions</span>
              </button>
              <button
                onClick={() => setMobileActiveTab("document")}
                className={`flex-1 py-2 text-xs font-bold rounded-full transition-all flex items-center justify-center ${
                  mobileActiveTab === "document"
                    ? "bg-[#292A2D] text-white shadow-xs"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                <span>Answer Sheet</span>
              </button>
            </div>

            <div className="flex-1 flex overflow-hidden p-3 md:p-4 gap-4 bg-[#F8F8F6]">
              <div
                className={`w-full md:w-[48%] lg:w-[46%] flex flex-col h-full bg-white rounded-2xl border border-neutral-200/90 shadow-xs overflow-hidden ${
                  mobileActiveTab === "document" ? "hidden md:flex" : "flex"
                }`}
              >
                <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between flex-shrink-0 bg-white">
                  <h2 className="font-bold text-sm sm:text-base text-neutral-900 tracking-tight">
                    Extracted Questions{" "}
                    <span className="text-neutral-600 font-normal">
                      (from question paper)
                    </span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => setExpandAll(!expandAll)}
                    className="hidden sm:inline-flex items-center text-xs font-semibold px-3.5 py-1 bg-white border border-neutral-200 hover:border-neutral-300 rounded-full text-neutral-700 shadow-2xs hover:bg-neutral-50 transition-colors cursor-pointer"
                  >
                    {expandAll ? "Collapse All" : "Expand All"}
                  </button>
                </div>

                <div className="px-4 py-2 border-b border-neutral-100 flex items-center gap-3 text-xs text-neutral-500 bg-[#FAFAFA]">
                  <span>
                    {
                      evaluation.questions.filter(
                        (q) =>
                          q.status !== "unanswered" &&
                          ((q.regions && q.regions.length > 0) ||
                            (q.boundingBox?.width ?? 0) > 0),
                      ).length
                    }
                    /{evaluation.questions.length} mapped
                  </span>
                  <span className="w-1 h-1 rounded-full bg-neutral-300" />
                  <span>
                    {evaluation.totalMarks}/{evaluation.maxMarks} marks
                  </span>
                  {evaluation.grounding?.usedGoogleSearch && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-neutral-300" />
                      <span className="text-emerald-700 font-semibold">
                        Grounded
                      </span>
                    </>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#FAFAFA]">
                  {evaluation.questions.map((question) => (
                    <QuestionCard
                      key={question.id}
                      question={question}
                      isSelected={
                        selectedQuestionId === question.id || expandAll
                      }
                      onSelect={() => handleSelectQuestion(question.id)}
                    />
                  ))}
                </div>
              </div>

              <div
                className={`w-full md:w-[52%] lg:w-[54%] h-full flex flex-col ${
                  mobileActiveTab === "questions" ? "hidden md:flex" : "flex"
                }`}
              >
                <DocumentViewer
                  questions={evaluation.questions}
                  selectedQuestionId={selectedQuestionId}
                  onSelectQuestion={handleSelectQuestion}
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                  totalPages={evaluation.totalPages}
                  sessionId={hasPageImages ? sessionId : null}
                />
              </div>
            </div>
          </>
        )}

        {!isLoading &&
          !failure &&
          !evaluation &&
          sessionQuery.isError && (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center space-y-3">
                <p className="text-sm text-red-700">
                  {sessionQuery.error instanceof Error
                    ? sessionQuery.error.message
                    : "Failed to load session"}
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#FF5722]"
                >
                  <ArrowLeft className="w-4 h-4" /> Re-upload
                </Link>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}

function FailedPanel({
  failure,
  sessionId,
  hasPageImages,
}: {
  failure: SessionFailure;
  sessionId: string | null;
  hasPageImages: boolean;
}) {
  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8">
      <div className="max-w-3xl mx-auto rounded-3xl border border-amber-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-amber-100 bg-amber-50/80 flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <FileWarning className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900">{failure.title}</h1>
            <p className="mt-1 text-sm text-neutral-600 leading-relaxed">
              {failure.summary}
            </p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {failure.issues.map((issue, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4"
            >
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-neutral-500 mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                {issue.file === "questionPaper"
                  ? "Question paper"
                  : issue.file === "answerSheet"
                    ? "Answer sheet"
                    : "Both files"}
              </div>
              <p className="text-sm text-neutral-800">{issue.message}</p>
              {issue.suggestions.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {issue.suggestions.map((s, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-neutral-600"
                    >
                      <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          {hasPageImages && sessionId && (
            <div className="rounded-2xl border border-neutral-200 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-neutral-500 mb-2">
                Answer sheet preview
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sessionPageUrl(sessionId, 1)}
                alt="Answer sheet preview"
                className="w-full max-h-72 object-contain rounded-xl border border-neutral-200 bg-neutral-100"
              />
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-900 text-white text-sm font-medium hover:bg-[#FF5722]"
            >
              <ArrowLeft className="w-4 h-4" />
              Re-upload files
            </Link>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              Retry load
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
