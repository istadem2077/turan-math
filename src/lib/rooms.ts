import { roomPhase, type RoomPhase } from "./timing";

export const PHASE_LABEL: Record<RoomPhase, string> = { SCHEDULED: "Scheduled", LIVE: "Live", FINISHED: "Finished" };
export const PHASE_TONE = { SCHEDULED: "brand", LIVE: "warn", FINISHED: "neutral" } as const;
export { roomPhase };
