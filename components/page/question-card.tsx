"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ExternalLink,
  Edit2,
  Check,
  FileText,
  HelpCircle,
  Bot
} from "lucide-react";
import { QuestionEvaluation, RubricStep } from "./mock-data";

interface QuestionCardProps {
  question: QuestionEvaluation;
  isSelected: boolean;
  onSelect: () => void;
  onUpdateScore?: (newScore: number, newRemarks?: string) => void;
}

export function QuestionCard({
  question,
  isSelected,
  onSelect,
  onUpdateScore,
}: QuestionCardProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(isSelected);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editScore, setEditScore] = useState<number>(question.marksObtained);
  const [editRemarks, setEditRemarks] = useState<string>(question.aiRemarks);

  // Sync expanded state with selection
  React.useEffect(() => {
    if (isSelected) {
      setIsExpanded(true);
    }
  }, [isSelected]);

  const handleSaveEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(false);
    if (onUpdateScore) {
      onUpdateScore(Number(editScore), editRemarks);
    }
  };

  const statusBadge = {
    correct: {
      bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
      label: "Full Marks",
    },
    partial: {
      bg: "bg-amber-50 text-amber-800 border-amber-200",
      icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />,
      label: "Partial Credit",
    },
    incorrect: {
      bg: "bg-red-50 text-red-700 border-red-200",
      icon: <XCircle className="w-3.5 h-3.5 text-red-600" />,
      label: "Incorrect",
    },
    unanswered: {
      bg: "bg-neutral-50 text-neutral-600 border-neutral-200",
      icon: <HelpCircle className="w-3.5 h-3.5 text-neutral-500" />,
      label: "Unanswered",
    },
  }[question.status];

  return (
    <div
      onClick={onSelect}
      className={`rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden ${
        isSelected
          ? "border-orange-500 bg-white ring-2 ring-orange-500/20 shadow-md"
          : "border-neutral-200/90 bg-white hover:border-neutral-300 hover:shadow-xs"
      }`}
    >
      {/* Header Row */}
      <div className="p-3.5 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 transition-colors ${
              isSelected
                ? "bg-orange-600 text-white shadow-xs"
                : "bg-neutral-100 text-neutral-700"
            }`}
          >
            Q{question.questionNumber}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-semibold text-neutral-900 truncate">
                {question.title}
              </h4>
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${statusBadge.bg}`}
              >
                {statusBadge.icon}
                <span>{statusBadge.label}</span>
              </span>
            </div>

            <p className="text-xs text-neutral-500 line-clamp-1 mt-0.5">
              {question.questionText}
            </p>
          </div>
        </div>

        {/* Score Pill & Expand Toggle */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-right">
            <div className="text-sm font-bold text-neutral-900">
              <span
                className={
                  question.marksObtained === question.maxMarks
                    ? "text-emerald-600"
                    : question.marksObtained > 0
                    ? "text-amber-600"
                    : "text-red-600"
                }
              >
                {question.marksObtained}
              </span>
              <span className="text-neutral-400 font-normal">
                /{question.maxMarks}
              </span>
            </div>
            <span className="text-[10px] text-neutral-400">Page {question.page}</span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-1 text-neutral-400 hover:text-neutral-700 rounded-md hover:bg-neutral-100 transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Accordion Body */}
      {isExpanded && (
        <div className="border-t border-neutral-100 bg-neutral-50/50 p-4 space-y-4 text-xs select-text">
          {/* Question Full Text */}
          <div className="p-2.5 rounded-lg bg-white border border-neutral-200/80">
            <p className="font-semibold text-neutral-500 uppercase tracking-wider text-[10px] mb-1">
              Question Statement
            </p>
            <p className="text-neutral-800 leading-relaxed">
              {question.questionText}
            </p>
          </div>

          {/* Model Answer vs Student Transcription */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-200/70">
              <p className="font-bold text-emerald-800 text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Reference Rubric / Model Answer</span>
              </p>
              <p className="text-emerald-950 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                {question.modelAnswer}
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-white border border-neutral-200/80">
              <p className="font-bold text-neutral-700 text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1">
                <FileText className="w-3 h-3 text-neutral-500" />
                <span>Extracted Handwritten Response</span>
              </p>
              <p className="text-neutral-800 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                {question.studentAnswerTranscription}
              </p>
            </div>
          </div>

          {/* Step-by-Step Rubric Criteria */}
          <div>
            <p className="font-semibold text-neutral-700 text-[11px] mb-1.5 flex items-center justify-between">
              <span>Step-by-Step Marking Breakdown</span>
              <span className="text-[10px] text-neutral-400 font-normal">
                Confidence: {question.confidence}%
              </span>
            </p>

            <div className="space-y-1.5">
              {question.rubric.map((step) => (
                <div
                  key={step.step}
                  className="flex items-start justify-between gap-2 p-2 rounded-lg bg-white border border-neutral-200/70 text-neutral-700"
                >
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded bg-neutral-100 text-neutral-600 flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">
                      {step.step}
                    </span>
                    <div>
                      <p className="text-[11px] font-medium text-neutral-800">
                        {step.description}
                      </p>
                      {step.note && (
                        <p className="text-[10px] text-amber-700 mt-0.5">
                          {step.note}
                        </p>
                      )}
                    </div>
                  </div>

                  <span
                    className={`font-semibold font-mono text-[11px] flex-shrink-0 ${
                      step.awarded === step.marks
                        ? "text-emerald-600"
                        : step.awarded > 0
                        ? "text-amber-600"
                        : "text-red-500"
                    }`}
                  >
                    +{step.awarded}/{step.marks} M
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Feedback & Teacher Override */}
          <div className="p-3 rounded-lg bg-orange-50/70 border border-orange-200/80">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-orange-900 font-bold text-[11px]">
                <Bot className="w-3.5 h-3.5 text-orange-600" />
                <span>AI Evaluation Remarks</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(!isEditing);
                }}
                className="text-[10px] font-medium text-orange-700 hover:text-orange-900 flex items-center gap-1 underline"
              >
                <Edit2 className="w-3 h-3" />
                <span>{isEditing ? "Cancel" : "Override Score"}</span>
              </button>
            </div>

            {isEditing ? (
              <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-semibold text-neutral-700">
                    Adjust Marks:
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={question.maxMarks}
                    value={editScore}
                    onChange={(e) => setEditScore(Number(e.target.value))}
                    className="w-16 px-2 py-1 bg-white border border-neutral-300 rounded text-xs font-bold font-mono text-neutral-900"
                  />
                  <span className="text-neutral-500">/ {question.maxMarks}</span>
                </div>
                <textarea
                  rows={2}
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  className="w-full p-2 bg-white border border-neutral-300 rounded text-xs text-neutral-800"
                  placeholder="Add customized teacher feedback..."
                />
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white font-medium text-xs rounded-md shadow-xs flex items-center gap-1"
                >
                  <Check className="w-3 h-3" />
                  <span>Apply Override</span>
                </button>
              </div>
            ) : (
              <p className="text-neutral-800 text-[11px] leading-relaxed mt-1">
                {question.aiRemarks}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
