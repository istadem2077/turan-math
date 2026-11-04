import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";

/** Turns a thrown error into a message suitable for a form. */
export function errorText(e: unknown): string {
  if (e instanceof z.ZodError) return e.issues.map((i) => i.message).join("; ");
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return "That username is already taken.";
  if (e instanceof Error) return e.message;
  return "Something went wrong.";
}
