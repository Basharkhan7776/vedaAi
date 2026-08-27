"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Clipboard,
  CircleHelp,
  Bell,
  ChevronDown,
  Sparkles,
  Menu
} from "lucide-react";
import { SidebarNav } from "./sidebar-nav";
import { DocumentViewer } from "./document-viewer";
import { QuestionCard } from "./question-card";
import { SAMPLE_EVALUATION } from "./mock-data";

export function AnalyzerPage() {
  const [sessionData] = useState(SAMPLE_EVALUATION);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>("q2"); // Q2 active by default matching Figma
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Collapsed rail on left matching Figma
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileActiveTab, setMobileActiveTab] = useState<"questions" | "document">("questions");
  const [expandAll, setExpandAll] = useState(false);

  const handleSelectQuestion = (qId: string) => {
    setSelectedQuestionId(qId);
    const targetQ = sessionData.questions.find((q) => q.id === qId);
    if (targetQ && targetQ.page !== currentPage) {
      setCurrentPage(targetQ.page);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#EBEBE8] p-2 md:p-3.5 gap-3 overflow-hidden text-neutral-900 font-sans">
      {/* Desktop Collapsed Sidebar Rail (Matching Figma Image 1) */}
      <div className="hidden md:flex h-full flex-shrink-0 transition-all duration-300">
        <SidebarNav
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />
      </div>

      {/* Mobile Drawer */}
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

      {/* Main Analyzer Floating Canvas Card */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-white bg-gradient-to-t from-neutral-200/40 via-neutral-100/15 to-white rounded-2xl md:rounded-3xl border border-neutral-200/80 shadow-sm overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-16 px-4 md:px-8 border-b border-neutral-100 flex items-center justify-between flex-shrink-0 select-none">
          {/* ========================================================= */}
          {/* 1. MOBILE TOP BAR (Exact match with reference image)      */}
          {/* ========================================================= */}
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

          {/* ========================================================= */}
          {/* 2. DESKTOP TOP BAR (Exact match with Image 1)             */}
          {/* ========================================================= */}
          <div className="hidden md:flex items-center justify-between w-full">
            {/* Left: Back Button in circle + Exams */}
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="w-9 h-9 rounded-full bg-white hover:bg-neutral-50 flex items-center justify-center text-neutral-800 transition-colors shadow-2xs border border-neutral-200/80 cursor-pointer"
                title="Back to Upload"
              >
                <ArrowLeft className="w-4 h-4 stroke-[2]" />
              </Link>

              <div className="flex items-center gap-2 text-neutral-400 font-medium text-base ml-1">
                <Clipboard className="w-5 h-5 stroke-[1.8]" />
                <span className="tracking-tight text-neutral-400">Exams</span>
              </div>
            </div>

            {/* Right: Help + Bell + Sparkle + Madhur Rastogi dropdown */}
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

        {/* Mobile View Segmented Switcher Tabs (Matching Mobile Screenshot) */}
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

        {/* Split-View Workspace Area */}
        <div className="flex-1 flex overflow-hidden p-3 md:p-4 gap-4 bg-[#F8F8F6]">
          {/* ========================================================= */}
          {/* Left Column: Extracted Questions (Matching Image 1 & 2)   */}
          {/* ========================================================= */}
          <div
            className={`w-full md:w-[48%] lg:w-[46%] flex flex-col h-full bg-white rounded-2xl border border-neutral-200/90 shadow-xs overflow-hidden ${
              mobileActiveTab === "document" ? "hidden md:flex" : "flex"
            }`}
          >
            {/* Header: Extracted Questions + Expand All button */}
            <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between flex-shrink-0 bg-white">
              <h2 className="font-bold text-sm sm:text-base text-neutral-900 tracking-tight">
                Extracted Questions <span className="text-neutral-600 font-normal">(from question paper)</span>
              </h2>

              <button
                type="button"
                onClick={() => setExpandAll(!expandAll)}
                className="hidden sm:inline-flex items-center text-xs font-semibold px-3.5 py-1 bg-white border border-neutral-200 hover:border-neutral-300 rounded-full text-neutral-700 shadow-2xs hover:bg-neutral-50 transition-colors cursor-pointer"
              >
                {expandAll ? "Collapse All" : "Expand All"}
              </button>
            </div>

            {/* Questions Scrollable List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#FAFAFA]">
              {sessionData.questions.map((question) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  isSelected={selectedQuestionId === question.id || expandAll}
                  onSelect={() => handleSelectQuestion(question.id)}
                />
              ))}
            </div>
          </div>

          {/* ========================================================= */}
          {/* Right Column: Answer Sheet Document Viewer (Empty PDF)    */}
          {/* ========================================================= */}
          <div
            className={`w-full md:w-[52%] lg:w-[54%] h-full flex flex-col ${
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
            />
          </div>
        </div>
      </div>
    </div>
  );
}
