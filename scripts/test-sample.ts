import fs from "fs";
import path from "path";
import { createSession, setSessionFiles, getSession } from "@/lib/session/store";
import { runEvaluationPipeline } from "@/lib/ai/pipeline";
import type { StoredFile } from "@/lib/types/evaluation";

async function main() {
  console.log("=================================================");
  console.log("🔍 TESTING SAMPLE PDF EVALUATION PIPELINE (BUN)");
  console.log("=================================================\n");

  const qpPath = path.join(process.cwd(), "public", "sample", "question.pdf");
  const asPath = path.join(process.cwd(), "public", "sample", "answer.pdf");

  if (!fs.existsSync(qpPath)) {
    throw new Error(`Question PDF not found at: ${qpPath}`);
  }
  if (!fs.existsSync(asPath)) {
    throw new Error(`Answer PDF not found at: ${asPath}`);
  }

  const qpBytes = fs.readFileSync(qpPath);
  const asBytes = fs.readFileSync(asPath);

  console.log(`📁 Loaded question.pdf: ${(qpBytes.length / 1024).toFixed(1)} KB`);
  console.log(`📁 Loaded answer.pdf  : ${(asBytes.length / 1024).toFixed(1)} KB\n`);

  const qpFile: StoredFile = {
    name: "question.pdf",
    mimeType: "application/pdf",
    bytes: qpBytes,
  };

  const asFile: StoredFile = {
    name: "answer.pdf",
    mimeType: "application/pdf",
    bytes: asBytes,
  };

  const session = createSession();
  setSessionFiles(session.id, qpFile, asFile);

  console.log(`🚀 Created session: ${session.id}`);
  console.log(`⏳ Running evaluation pipeline...\n`);

  const startTime = Date.now();
  await runEvaluationPipeline(session.id);
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  const updated = getSession(session.id);
  if (!updated) {
    throw new Error("Session vanished from store");
  }

  console.log("\n=================================================");
  console.log(`📊 PIPELINE RUN COMPLETED in ${duration}s`);
  console.log("=================================================");
  console.log("Status:", updated.status);

  if (updated.failure) {
    console.error("\n❌ EVALUATION FAILED with failure object:");
    console.error(JSON.stringify(updated.failure, null, 2));
    process.exit(1);
  }

  if (updated.evaluation) {
    const evalData = updated.evaluation;
    console.log("\n✅ EVALUATION SUCCESSFUL!");
    console.log(`📌 Title        : ${evalData.title}`);
    console.log(`📌 Subject      : ${evalData.subject}`);
    console.log(`📌 Grade        : ${evalData.grade}`);
    console.log(`📌 Student      : ${evalData.studentName} (${evalData.rollNumber || "No Roll #"})`);
    console.log(`📌 Total Marks  : ${evalData.totalMarks} / ${evalData.maxMarks} (${evalData.percentage}%)`);
    console.log(`📌 Grade Badge  : ${evalData.gradeBadge}`);
    console.log(`📌 Total Pages  : ${evalData.totalPages}`);
    console.log(`📌 Questions (#): ${evalData.questions.length}`);
    console.log(`📌 Unmapped (#) : ${evalData.unmappedAnswers?.length || 0}`);

    console.log("\n--- DETAILED QUESTIONS BREAKDOWN ---");
    evalData.questions.forEach((q, idx) => {
      const boxStr = q.regions.map(r => `P${r.page}:[x=${r.box.x}%, y=${r.box.y}%, w=${r.box.width}%, h=${r.box.height}%]`).join(" | ");
      console.log(`\n[#${idx + 1}] Question ${q.number}: "${q.questionText.slice(0, 70).replace(/\n/g, ' ')}..."`);
      console.log(`     Status       : [${q.status.toUpperCase()}]`);
      console.log(`     Score        : ${q.marksObtained} / ${q.maxMarks}`);
      console.log(`     Regions      : ${q.regions.length > 0 ? boxStr : "None (Unanswered)"}`);
      console.log(`     Student Ans  : "${q.studentAnswer.slice(0, 80).replace(/\n/g, ' ')}..."`);
      console.log(`     AI Feedback  : "${q.aiRemarks}"`);
    });

    if (evalData.unmappedAnswers && evalData.unmappedAnswers.length > 0) {
      console.log("\n--- UNMAPPED ANSWERS ---");
      evalData.unmappedAnswers.forEach((u, i) => {
        console.log(`[#${i + 1}] Transcription: "${u.transcription}" | Regions: ${u.regions.length}`);
      });
    }
  }

  console.log("\n🎉 Test script finished cleanly.");
}

main().catch((err) => {
  console.error("\n💥 Fatal error in test script:", err);
  process.exit(1);
});
