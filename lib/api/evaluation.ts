import { api } from "@/lib/api/client";
import type {
  EvaluationSession,
  SessionFailure,
  SessionStatus,
} from "@/lib/types/evaluation";

export type StartEvaluationResponse = {
  sessionId: string;
  demo?: boolean;
  forceFail?: boolean;
  message?: string;
  error?: string;
};

export type SessionSuccessResponse = {
  ok: true;
  evaluation: EvaluationSession;
  status: SessionStatus;
  hasPageImages: boolean;
};

export type SessionFailureResponse = {
  ok: false;
  pending?: boolean;
  failure?: SessionFailure;
  status: SessionStatus;
  hasPageImages?: boolean;
};

export type SessionResponse = SessionSuccessResponse | SessionFailureResponse;

export async function startEvaluation(args: {
  questionPaper: File;
  answerSheet: File;
  demo?: boolean;
  forceFail?: boolean;
}): Promise<StartEvaluationResponse> {
  const form = new FormData();
  form.append("questionPaper", args.questionPaper);
  form.append("answerSheet", args.answerSheet);
  if (args.demo) form.append("demo", "true");
  if (args.forceFail) form.append("forceFail", "true");

  const { data } = await api.post<StartEvaluationResponse>(
    "/api/evaluate",
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 60_000,
    },
  );
  return data;
}

export async function getSessionStatus(
  sessionId: string,
): Promise<SessionStatus> {
  const { data } = await api.get<SessionStatus>(
    `/api/sessions/${sessionId}/status`,
  );
  return data;
}

export async function getSession(
  sessionId: string,
): Promise<SessionResponse> {
  const { data } = await api.get<SessionResponse>(
    `/api/sessions/${sessionId}`,
    {
      // 202 while pending is valid
      validateStatus: (s) => (s >= 200 && s < 300) || s === 202,
    },
  );
  return data;
}

export function sessionPageUrl(sessionId: string, page: number) {
  return `/api/sessions/${sessionId}/pages/${page}`;
}

export const evaluationKeys = {
  all: ["evaluation"] as const,
  status: (id: string) => ["evaluation", "status", id] as const,
  session: (id: string) => ["evaluation", "session", id] as const,
};
