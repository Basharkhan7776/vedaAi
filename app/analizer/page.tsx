import { Suspense } from "react";
import { AnalyzerPage } from "@/components/page/analyzer-page";

export const metadata = {
  title: "Veda AI — Evaluation Analyzer & Document Annotations",
  description:
    "Detailed evaluation breakdown, rubric steps, and annotated student answer sheets.",
};

export default function AnalyzerServerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center text-sm text-neutral-500">
          Loading analyzer…
        </div>
      }
    >
      <AnalyzerPage />
    </Suspense>
  );
}
