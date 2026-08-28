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
  Layers,
} from "lucide-react";
import { SidebarNav } from "./sidebar-nav";
import { DocumentViewer } from "./document-viewer";
import { QuestionCard } from "./question-card";
import { SAMPLE_EVALUATION } from "./mock-data";
import { useEvaluationSession } from "@/lib/api/hooks";
import type { EvaluationSession, MappedQuestion, SessionFailure } from "@/lib/types/evaluation";

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
  const [selectedSection, setSelectedSection] = useState<string>("all");

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

  // Distinct sections
  const availableSections = useMemo(() => {
    if (!evaluation) return [];
    if (evaluation.sections && evaluation.sections.length > 0) {
      return evaluation.sections;
    }
    const secNames = Array.from(
      new Set(evaluation.questions.map((q) => q.section).filter(Boolean)),
    ) as string[];
    return secNames.map((name) => ({ name }));
  }, [evaluation]);

  // Filtered questions based on selectedSection
  const filteredQuestions = useMemo(() => {
    if (!evaluation) return [];
    if (selectedSection === "all") return evaluation.questions;
    return evaluation.questions.filter(
      (q) => (q.section || "General") === selectedSection,
    );
  }, [evaluation, selectedSection]);

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
                <span className="font-bold text-neutral-900">
                  {evaluation?.title || "Exam Evaluation"}
                </span>
                {evaluation?.subject && (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600 border border-neutral-200">
                    {evaluation.subject} {evaluation.grade ? `• ${evaluation.grade}` : ""}
                  </span>
                )}
                {evaluation?.totalPaperMarks && (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                    Max: {evaluation.totalPaperMarks} Marks
                  </span>
                )}
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
                <span className="text-sm font-semibold">
                  {evaluation?.studentName || "Madhur Rastogi"}
                </span>
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
                {/* Header Bar */}
                <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between flex-shrink-0 bg-white">
                  <div>
                    <h2 className="font-bold text-sm sm:text-base text-neutral-900 tracking-tight">
                      Extracted Questions{" "}
                      <span className="text-neutral-600 font-normal">
                        ({evaluation.questions.length})
                      </span>
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandAll(!expandAll)}
                    className="hidden sm:inline-flex items-center text-xs font-semibold px-3.5 py-1 bg-white border border-neutral-200 hover:border-neutral-300 rounded-full text-neutral-700 shadow-2xs hover:bg-neutral-50 transition-colors cursor-pointer"
                  >
                    {expandAll ? "Collapse All" : "Expand All"}
                  </button>
                </div>

                {/* Score & Mapping Stats Summary Bar */}
                <div className="px-4 py-2 border-b border-neutral-100 flex items-center justify-between text-xs text-neutral-500 bg-[#FAFAFA]">
                  <div className="flex items-center gap-3">
                    <span>
                      {
                        evaluation.questions.filter(
                          (q) =>
                            q.status !== "unanswered" &&
                            q.status !== "optional_skipped" &&
                            ((q.regions && q.regions.length > 0) ||
                              (q.boundingBox?.width ?? 0) > 0),
                        ).length
                      }
                      /{evaluation.questions.length} mapped
                    </span>
                    <span className="w-1 h-1 rounded-full bg-neutral-300" />
                    <span className="font-bold text-neutral-900">
                      {evaluation.totalMarks}/{evaluation.maxMarks} marks ({evaluation.percentage}%)
                    </span>
                  </div>

                  <span className="font-bold text-xs px-2 py-0.5 rounded-full bg-[#EAF8F0] text-[#1E9E54] border border-[#1E9E54]/20">
                    {evaluation.gradeBadge}
                  </span>
                </div>

                {/* Section Navigation Tabs */}
                {availableSections.length > 1 && (
                  <div className="px-4 py-2 border-b border-neutral-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-white flex-shrink-0">
                    <button
                      onClick={() => setSelectedSection("all")}
                      className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                        selectedSection === "all"
                          ? "bg-[#292A2D] text-white shadow-xs"
                          : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200/70"
                      }`}
                    >
                      All ({evaluation.questions.length})
                    </button>
                    {availableSections.map((sec) => {
                      const count = evaluation.questions.filter(
                        (q) => (q.section || "General") === sec.name,
                      ).length;
                      return (
                        <button
                          key={sec.name}
                          onClick={() => setSelectedSection(sec.name)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                            selectedSection === sec.name
                              ? "bg-[#292A2D] text-white shadow-xs"
                              : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200/70"
                          }`}
                        >
                          {sec.name} ({count})
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Question List with Section Dividers */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FAFAFA]">
                  {filteredQuestions.map((question, idx) => {
                    const isFirstInSection =
                      selectedSection === "all" &&
                      question.section &&
                      (idx === 0 || filteredQuestions[idx - 1].section !== question.section);

                    const sectionMeta = evaluation.sections?.find(
                      (s) => s.name === question.section,
                    );

                    return (
                      <React.Fragment key={question.id}>
                        {isFirstInSection && (
                          <div className="pt-2 pb-1 first:pt-0">
                            <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-neutral-200/70 border border-neutral-300/70 shadow-2xs">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-xs text-neutral-900 uppercase tracking-wide">
                                  {question.section}
                                </span>
                                {sectionMeta?.title && (
                                  <span className="text-[11px] font-medium text-neutral-600">
                                    • {sectionMeta.title}
                                  </span>
                                )}
                              </div>
                              {sectionMeta?.totalMarks && (
                                <span className="text-[11px] font-bold text-neutral-700 bg-white px-2 py-0.5 rounded-full border border-neutral-200/80 shadow-2xs">
                                  {sectionMeta.totalMarks} Marks
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        <QuestionCard
                          question={question}
                          isSelected={
                            selectedQuestionId === question.id || expandAll
                          }
                          onSelect={() => handleSelectQuestion(question.id)}
                        />
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Document Viewer (Right Column) */}
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
          !sessionId &&
          isDemoBrowse && (
            <div className="flex-1 flex items-center justify-center p-8 text-neutral-500">
              No evaluation data available.
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
  hasPageImages?: boolean;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 max-w-2xl mx-auto w-full text-left">
      <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center text-red-600 mb-5 shadow-xs">
        <AlertTriangle className="w-7 h-7 stroke-[2.2]" />
      </div>

      <h2 className="text-xl sm:text-2xl font-extrabold text-neutral-900 text-center tracking-tight">
        {failure.title || "Evaluation Could Not Be Completed"}
      </h2>
      <p className="text-sm text-neutral-600 mt-2 text-center max-w-md leading-relaxed">
        {failure.summary ||
          "There was an issue processing or verifying your exam documents."}
      </p>

      {failure.issues && failure.issues.length > 0 && (
        <div className="w-full bg-[#FFFBFB] rounded-2xl border border-red-200/80 p-4 sm:p-5 mt-6 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-red-800 uppercase tracking-wider">
            <FileWarning className="w-4 h-4" />
            Detected Issues
          </div>
          <div className="space-y-2">
            {failure.issues.map((issue, idx) => (
              <div
                key={idx}
                className="bg-white p-3 rounded-xl border border-red-100 text-xs text-neutral-800 space-y-1"
              >
                <div className="font-semibold text-red-900">
                  {issue.file === "questionPaper"
                    ? "📄 Question Paper"
                    : issue.file === "answerSheet"
                      ? "📝 Answer Sheet"
                      : "📑 Uploaded Files"}
                </div>
                <p className="text-neutral-600 leading-normal font-normal">
                  {issue.message}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {failure.suggestions && failure.suggestions.length > 0 && (
        <div className="w-full bg-[#FAFAFA] rounded-2xl border border-neutral-200/80 p-4 sm:p-5 mt-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-neutral-700 uppercase tracking-wider">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            Suggested Actions
          </div>
          <ul className="list-disc list-inside text-xs text-neutral-600 space-y-1 font-normal">
            {failure.suggestions.map((sug, idx) => (
              <li key={idx}>{sug}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 flex items-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#FF5722] text-white font-bold text-xs hover:bg-[#F4511E] transition-colors shadow-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Upload New Documents
        </Link>
      </div>
    </div>
  );
}
