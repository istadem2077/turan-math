/**
 * Fixed-start timing. Everyone in a room begins module 1 at `startsAt`; module
 * 1 closes for everyone `moduleMinutes` later. A student who submits module 1
 * early starts module 2 immediately; otherwise module 2 starts when module 1
 * closes. Module 2 lasts `moduleMinutes` from its own start.
 */
export const GRACE_MS = 10_000;

export type RoomTiming = { startsAt: Date; moduleMinutes: number };

export const moduleMs = (r: RoomTiming) => r.moduleMinutes * 60_000;

export function module1Deadline(r: RoomTiming): Date {
  return new Date(r.startsAt.getTime() + moduleMs(r));
}

/** Latest moment anything can still happen in the room. */
export function roomEndsAt(r: RoomTiming): Date {
  return new Date(r.startsAt.getTime() + 2 * moduleMs(r));
}

export type RoomPhase = "SCHEDULED" | "LIVE" | "FINISHED";

export function roomPhase(r: RoomTiming, now = new Date()): RoomPhase {
  if (now < r.startsAt) return "SCHEDULED";
  if (now < roomEndsAt(r)) return "LIVE";
  return "FINISHED";
}

export function module2Deadline(r: RoomTiming, module2StartedAt: Date): Date {
  return new Date(module2StartedAt.getTime() + moduleMs(r));
}
