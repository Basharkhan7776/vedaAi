"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  evaluationKeys,
  getSession,
  getSessionStatus,
  startEvaluation,
} from "@/lib/api/evaluation";

export function useStartEvaluation() {
  return useMutation({
    mutationFn: startEvaluation,
  });
}

export function useSessionStatus(
  sessionId: string | null,
  opts?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: evaluationKeys.status(sessionId ?? "none"),
    queryFn: () => getSessionStatus(sessionId!),
    enabled: Boolean(sessionId) && (opts?.enabled ?? true),
    refetchInterval: (query) => {
      const status = query.state.data;
      if (!status) return 800;
      if (status.terminal) return false;
      return 800;
    },
  });
}

export function useEvaluationSession(
  sessionId: string | null,
  opts?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: evaluationKeys.session(sessionId ?? "none"),
    queryFn: () => getSession(sessionId!),
    enabled: Boolean(sessionId) && (opts?.enabled ?? true),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 1000;
      if ("pending" in data && data.pending) return 1000;
      if (data.status?.terminal) return false;
      return 1000;
    },
    retry: (failureCount, error) => {
      // Don't spin forever on 404
      if (error instanceof Error && /not found/i.test(error.message)) {
        return false;
      }
      return failureCount < 2;
    },
  });
}
