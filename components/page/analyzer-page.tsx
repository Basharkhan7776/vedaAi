"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  Share2,
  Download,
  RotateCw,
  Sparkles,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Menu,
  GraduationCap,
  Award,
  BookOpen,
  ArrowLeft,
  Eye,
  Layers,
  ChevronRight
} from "lucide-react";
import { SidebarNav } from "./sidebar-nav";
import { DocumentViewer } from "./document-viewer";
import { QuestionCard } from "./question-card";
import { SAMPLE_EVALUATION, QuestionEvaluation, EvaluationSession } from "./mock-data";

export function AnalyzerPage() {
  const searchParams = useSearchParams();
  const [sessionData, setSessionData] = useState<EvaluationSession>(SAMPLE_EVALUATION);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [hasPageImages, setHasPageImages] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>("q1");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [filterStatus, setFilterStatus] = useState<"all" | "correct" | "partial" | "incorrect" | "unanswered">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileActiveTab, setMobileActiveTab] = useState<"questions" | "document">("questions");

  useEffect(() => {
    const fromQuery = searchParams.get("session");
    const fromStorage =
      typeof window !== "undefined"
        ? sessionStorage.getItem("veda-session-id")
        : null;
    const id = fromQuery || fromStorage;
    if (!id) return;

    setSessionId(id);
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/sessions/${id}`);
        if (!res.ok) {
          if (res.status === 404) {
            setLoadError(null);
            return;
          }
          throw new Error("Could not load evaluation session");
        }
        const data = (await res.json()) as EvaluationSession;
        if (cancelled) return;
        setSessionData({
          ...data,
          unmappedAnswers: data.unmappedAnswers ?? [],
        });
        setSelectedQuestionId(data.questions[0]?.id ?? "q1");
        setCurrentPage(data.questions[0]?.page ?? 1);

        const pageProbe = await fetch(`/api/sessions/${id}/pages/1`);
        setHasPageImages(pageProbe.ok);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Load failed");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  // Handle selecting a question: auto sync page with the question's page
  const handleSelectQuestion = (qId: string) => {
    setSelectedQuestionId(qId);
    const targetQ = sessionData.questions.find((q) => q.id === qId);
    if (targetQ) {
      const page =
        targetQ.regions?.[0]?.page ?? targetQ.page ?? currentPage;
      if (page !== currentPage) setCurrentPage(page);
    }
  };

  // Teacher manual override update
  const handleUpdateScore = (qId: string, newScore: number, newRemarks?: string) => {
    setSessionData((prev) => {
      const updatedQuestions = prev.questions.map((q) => {
        if (q.id === qId) {
          const updatedStatus: QuestionEvaluation["status"] =
            newScore === q.maxMarks
              ? "correct"
              : newScore > 0
                ? "partial"
                : "incorrect";
          return {
            ...q,
            marksObtained: newScore,
            status: updatedStatus,
            aiRemarks: newRemarks || q.aiRemarks,
          };
        }
        return q;
      });

      const newTotal = updatedQuestions.reduce((acc, q) => acc + q.marksObtained, 0);
      const newPercentage = Number(((newTotal / prev.maxMarks) * 100).toFixed(1));

      return {
        ...prev,
        questions: updatedQuestions,
        totalMarks: newTotal,
        percentage: newPercentage,
      };
    });
  };

  // Filtered Questions List
  const filteredQuestions = sessionData.questions.filter((q) => {
    const matchesFilter = filterStatus === "all" || q.status === filterStatus;
    const matchesSearch =
      q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.questionText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `q${q.questionNumber}`.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const correctCount = sessionData.questions.filter((q) => q.status === "correct").length;
  const partialCount = sessionData.questions.filter((q) => q.status === "partial").length;
  const incorrectCount = sessionData.questions.filter((q) => q.status === "incorrect").length;

  return (
    <div className="flex h-screen w-full bg-[#FBFBFA] overflow-hidden text-neutral-900">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block h-full flex-shrink-0">
        <SidebarNav />
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-neutral-900/50 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 w-72 bg-white h-full shadow-2xl">
            <SidebarNav onCloseMobile={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Analyzer Canvas */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Top Evaluation Header Bar */}
        <header className="px-4 py-2.5 bg-white border-b border-neutral-200/80 flex flex-wrap items-center justify-between gap-3 flex-shrink-0 select-none">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 -ml-1 text-neutral-600 hover:text-neutral-900 lg:hidden rounded-lg hover:bg-neutral-100"
            >
              <Menu className="w-5 h-5" />
            </button>

            <Link
              href="/"
              className="p-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-neutral-600 hover:text-neutral-900 transition-colors"
              title="Back to Upload"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm md:text-base font-bold text-neutral-900 truncate">
                  {sessionData.title}
                </h1>
                <span className="text-[10px] bg-orange-100 text-orange-800 font-bold px-2 py-0.5 rounded-full border border-orange-200">
                  AI Evaluated
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                Student: <span className="font-medium text-neutral-800">{sessionData.studentName}</span> ({sessionData.rollNumber}) • {sessionData.grade}
              </p>
            </div>
          </div>

          {/* Score Chip & Actions */}
          <div className="flex items-center gap-2.5">
            {/* Total Marks Pill */}
            <div className="flex items-center gap-2 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200/80 px-3.5 py-1.5 rounded-xl shadow-xs">
              <Award className="w-4 h-4 text-orange-600" />
              <div>
                <div className="text-xs font-bold text-neutral-900 flex items-center gap-1">
                  <span>Score:</span>
                  <span className="text-orange-700 font-mono text-sm">
                    {sessionData.totalMarks}/{sessionData.maxMarks}
                  </span>
                  <span className="text-neutral-400 font-normal">
                    ({sessionData.percentage}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Export & Actions */}
            <button
              onClick={() => alert("Exporting PDF evaluation report...")}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-neutral-900 text-white hover:bg-neutral-800 transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export PDF</span>
            </button>
          </div>
        </header>

        {/* Mobile View Switcher Tabs */}
        <div className="flex md:hidden bg-white border-b border-neutral-200 p-1.5">
          <button
            onClick={() => setMobileActiveTab("questions")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
              mobileActiveTab === "questions"
                ? "bg-orange-50 text-orange-700 shadow-xs"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Questions & Rubric ({sessionData.questions.length})</span>
          </button>
          <button
            onClick={() => setMobileActiveTab("document")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
              mobileActiveTab === "document"
                ? "bg-orange-50 text-orange-700 shadow-xs"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Answer Sheet (P.{currentPage})</span>
          </button>
        </div>

        {/* Split-View Workspace Area */}
        <div className="flex-1 flex overflow-hidden p-3 md:p-4 gap-4">
          {/* Left Column: Questions Breakdown List */}
          <div
            className={`w-full md:w-[48%] lg:w-[45%] flex flex-col h-full bg-white rounded-2xl border border-neutral-200/90 shadow-xs overflow-hidden ${
              mobileActiveTab === "document" ? "hidden md:flex" : "flex"
            }`}
          >
            {/* Filter & Search Bar */}
            <div className="p-3.5 border-b border-neutral-200/80 space-y-2.5 bg-neutral-50/40">
              {/* Quick Performance Stats Pills */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-white p-2 rounded-xl border border-neutral-200/80">
                  <p className="text-[10px] text-neutral-400 font-bold uppercase">Questions</p>
                  <p className="font-extrabold text-neutral-900 text-sm">
                    {sessionData.questions.length}
                  </p>
                </div>
                <div className="bg-emerald-50/70 p-2 rounded-xl border border-emerald-200/70">
                  <p className="text-[10px] text-emerald-700 font-bold uppercase">Full Marks</p>
                  <p className="font-extrabold text-emerald-800 text-sm">{correctCount}</p>
                </div>
                <div className="bg-amber-50/70 p-2 rounded-xl border border-amber-200/70">
                  <p className="text-[10px] text-amber-700 font-bold uppercase">Partial</p>
                  <p className="font-extrabold text-amber-800 text-sm">{partialCount}</p>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-0.5">
                <button
                  onClick={() => setFilterStatus("all")}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors flex-shrink-0 ${
                    filterStatus === "all"
                      ? "bg-neutral-900 text-white"
                      : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-100"
                  }`}
                >
                  All ({sessionData.questions.length})
                </button>
                <button
                  onClick={() => setFilterStatus("correct")}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors flex-shrink-0 ${
                    filterStatus === "correct"
                      ? "bg-emerald-700 text-white"
                      : "bg-white border border-neutral-200 text-emerald-700 hover:bg-emerald-50"
                  }`}
                >
                  Correct ({correctCount})
                </button>
                <button
                  onClick={() => setFilterStatus("partial")}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors flex-shrink-0 ${
                    filterStatus === "partial"
                      ? "bg-amber-700 text-white"
                      : "bg-white border border-neutral-200 text-amber-800 hover:bg-amber-50"
                  }`}
                >
                  Partial ({partialCount})
                </button>
              </div>

              {/* Search Box */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search questions, concepts, or formulas..."
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-hidden focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
              </div>
            </div>

            {/* Questions Scrollable List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {filteredQuestions.length === 0 ? (
                <div className="p-8 text-center text-neutral-400 text-xs">
                  No questions match your filter criteria.
                </div>
              ) : (
                filteredQuestions.map((question) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    isSelected={selectedQuestionId === question.id}
                    onSelect={() => handleSelectQuestion(question.id)}
                    onUpdateScore={(newScore, newRemarks) =>
                      handleUpdateScore(question.id, newScore, newRemarks)
                    }
                  />
                ))
              )}
            </div>
          </div>

          {/* Right Column: Scanned & Annotated Answer Sheet Document Viewer */}
          <div
            className={`w-full md:w-[52%] lg:w-[55%] h-full flex flex-col ${
              mobileActiveTab === "questions" ? "hidden md:flex" : "flex"
            }`}
          >
            <DocumentViewer
              questions={sessionData.questions}
              selectedQuestionId={selectedQuestionId}
              onSelectQuestion={handleSelectQuestion}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
              totalPages={sessionData.totalPages}
              sessionId={hasPageImages ? sessionId : null}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
