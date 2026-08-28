"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { MappedQuestion } from "@/lib/types/evaluation";
import { parseQuestionNumber } from "@/lib/ai/gemini";

interface QuestionCardProps {
  question: MappedQuestion;
  isSelected?: boolean;
  onSelect?: () => void;
  onUpdateScore?: (newScore: number, newRemarks?: string) => void;
}

export function QuestionCard({
  question,
  isSelected = false,
  onSelect,
}: QuestionCardProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(isSelected);

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
    if (!isSelected && onSelect) {
      onSelect();
    }
  };

  const handleCardClick = () => {
    if (onSelect) {
      onSelect();
    }
    setIsExpanded(true);
  };

  // Derive display parent number and sub-part
  const parsed = parseQuestionNumber(question.number || String(question.questionNumber));
  const displayParent =
    question.parentQuestionNumber ||
    parsed.parentNumber ||
    String(question.questionNumber);
  const displaySub =
    question.subPart ||
    parsed.subPart ||
    (question.subNumber ? question.subNumber.replace(/^[0-9]+\s*/, "").replace(/\.$/, "") : null);

  // Score Pill Styling Matching Figma Reference
  const isSkipped = question.status === "optional_skipped";
  const isFullMarks = question.marksObtained === question.maxMarks;
  const isZero = question.marksObtained === 0;

  const scoreBadgeStyle = isSkipped
    ? "bg-neutral-100 text-neutral-500"
    : isFullMarks
    ? "bg-[#EAF8F0] text-[#1E9E54]" // Soft Green
    : isZero
    ? "bg-[#FEECEC] text-[#EB4335]" // Soft Red
    : "bg-[#FFF4E6] text-[#F38A00]"; // Soft Orange

  const isCardActive = isSelected || isExpanded;

  return (
    <div
      onClick={handleCardClick}
      className={`bg-white rounded-2xl p-4 transition-all duration-200 cursor-pointer ${
        isCardActive
          ? "border-2 border-[#FF5722] shadow-xs"
          : "border border-neutral-200/90 hover:border-neutral-300 shadow-2xs"
      }`}
    >
      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-3">
        {/* Question Number & Sub-part Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Circular Parent Number Badge */}
          <div
            className={`w-7 h-7 rounded-full font-bold text-xs flex items-center justify-center transition-colors flex-shrink-0 ${
              isCardActive ? "bg-[#FF5722] text-white" : "bg-[#4A4D52] text-white"
            }`}
          >
            {displayParent}
          </div>

          {/* Sub-part Label (e.g. "i.", "ii.", "a.", "b.") */}
          {displaySub && (
            <span className="text-xs font-bold text-neutral-800 ml-0.5 tracking-tight">
              {displaySub.endsWith(".") ? displaySub : `${displaySub}.`}
            </span>
          )}

          {/* Section Tag */}
          {question.section && (
            <span className="ml-1 px-2 py-0.5 rounded-md bg-neutral-100 text-[10px] font-semibold text-neutral-600 border border-neutral-200/60">
              {question.section}
            </span>
          )}

          {/* Optional / Choice Pill */}
          {question.isOptional && (
            <span className="px-1.5 py-0.5 rounded-md bg-amber-50 text-[10px] font-medium text-amber-700 border border-amber-200/60">
              Choice
            </span>
          )}
        </div>

        {/* Right: Score Pill + Chevron Toggle */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div
            className={`px-2.5 py-0.5 rounded-full font-bold text-xs tracking-tight ${scoreBadgeStyle}`}
          >
            {isSkipped
              ? "Skipped"
              : `${question.marksObtained}/${question.maxMarks}`}
          </div>

          <button
            type="button"
            onClick={toggleExpand}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer"
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 stroke-[2.2]" />
            ) : (
              <ChevronDown className="w-4 h-4 stroke-[2.2]" />
            )}
          </button>
        </div>
      </div>

      {/* Question Prompt Text */}
      <p className="text-xs sm:text-sm font-normal text-neutral-900 leading-snug mt-2.5">
        {question.questionText}
      </p>

      {/* Expanded AI Feedback Section (Matching Figma Reference) */}
      {isExpanded && (question.aiRemarks || question.studentAnswer) && (
        <div className="bg-[#F8F8F7] rounded-xl p-3.5 mt-3 space-y-2 border border-neutral-200/50 animate-in fade-in-50 duration-200">
          {question.studentAnswer && (
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                Student Solution
              </span>
              <p className="text-xs text-neutral-800 font-medium leading-relaxed bg-white p-2.5 rounded-lg border border-neutral-200/60">
                {question.studentAnswer}
              </p>
            </div>
          )}

          {question.aiRemarks && (
            <div className="space-y-0.5 pt-1">
              <h4 className="text-xs font-bold text-neutral-900 tracking-tight">
                AI Feedback
              </h4>
              <p className="text-xs text-neutral-600 leading-relaxed font-normal">
                {question.aiRemarks}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
