"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { QuestionEvaluation } from "./mock-data";

interface QuestionCardProps {
  question: QuestionEvaluation;
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

  // Score Pill Styling Matching Figma Reference
  const isFullMarks = question.marksObtained === question.maxMarks;
  const isZero = question.marksObtained === 0;

  const scoreBadgeStyle = isFullMarks
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
        {/* Question Number Badge */}
        <div className="flex items-center gap-1.5">
          <div
            className={`w-7 h-7 rounded-full font-bold text-xs flex items-center justify-center transition-colors flex-shrink-0 ${
              isCardActive ? "bg-[#FF5722] text-white" : "bg-[#4A4D52] text-white"
            }`}
          >
            {question.questionNumber}
          </div>

          {question.subNumber && (
            <span className="text-xs font-bold text-neutral-800 ml-0.5">
              {question.subNumber}
            </span>
          )}
        </div>

        {/* Right: Score Pill + Chevron Toggle */}
        <div className="flex items-center gap-2">
          <div
            className={`px-2.5 py-0.5 rounded-full font-bold text-xs tracking-tight ${scoreBadgeStyle}`}
          >
            {question.marksObtained}/{question.maxMarks}
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
      {isExpanded && question.aiRemarks && (
        <div className="bg-[#F8F8F7] rounded-xl p-3.5 mt-3 space-y-1 border border-neutral-200/50 animate-in fade-in-50 duration-200">
          <h4 className="text-xs font-bold text-neutral-900 tracking-tight">
            AI Feedback
          </h4>
          <p className="text-xs text-neutral-600 leading-relaxed font-normal">
            {question.aiRemarks}
          </p>
        </div>
      )}
    </div>
  );
}
