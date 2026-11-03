import { quizPhase, type QuizPhase } from "./timing";

export const PHASE_LABEL: Record<QuizPhase, string> = {
  NOT_STARTED: "Not started",
  SCHEDULED: "Scheduled",
  LOBBY: "Lobby open",
  LIVE: "Live",
  FINISHED: "Finished",
};
export const PHASE_TONE = { NOT_STARTED: "neutral", SCHEDULED: "brand", LOBBY: "warn", LIVE: "warn", FINISHED: "neutral" } as const;
export { quizPhase };
