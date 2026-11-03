import "server-only";
import { db } from "./db";
import { MAX_FILES_PER_UPLOAD, MAX_FILE_BYTES, MAX_UPLOAD_BYTES, extOf, formatsLabel, mimeFor } from "./file-formats";
import type { CurrentUser } from "./auth";

/** Non-empty File entries of a form field. */
export function formFiles(form: FormData, name: string): File[] {
  return form.getAll(name).filter((f): f is File => f instanceof File && f.size > 0 && !!f.name);
}

/** Throws a user-facing error if the files break the size/count/format rules. */
export function checkFiles(files: File[], allowed: string[] = []) {
  if (files.length > MAX_FILES_PER_UPLOAD) throw new Error(`Upload at most ${MAX_FILES_PER_UPLOAD} files at a time.`);
  let total = 0;
  for (const f of files) {
    total += f.size;
    if (f.size > MAX_FILE_BYTES) throw new Error(`"${f.name}" is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB.`);
    if (allowed.length && !allowed.includes(extOf(f.name)))
      throw new Error(`"${f.name}" isn't an accepted format. Accepted: ${formatsLabel(allowed)}.`);
  }
  if (total > MAX_UPLOAD_BYTES) throw new Error(`Files must total under ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
}

type Owner = { homeworkId: string } | { submissionId: string } | { feedbackSubmissionId: string };

export async function toFileRows(files: File[], owner: Owner, uploadedById: string) {
  return Promise.all(
    files.map(async (f) => ({
      ...owner,
      uploadedById,
      filename: f.name.slice(0, 200),
      mimeType: mimeFor(f.name),
      size: f.size,
      data: new Uint8Array(await f.arrayBuffer()),
    })),
  );
}

/** Metadata only (never the bytes). */
export const FILE_META = { id: true, filename: true, size: true, createdAt: true } as const;
export type FileMeta = { id: string; filename: string; size: number; createdAt: Date };

/**
 * Can this user download the file? Staff: any homework file. Students: the
 * assignment files of homework in their rooms, and the files (and feedback
 * files) of their own submissions.
 */
export async function canReadFile(user: CurrentUser, fileId: string): Promise<boolean> {
  if (user.role !== "STUDENT") return true;
  const n = await db.storedFile.count({
    where: {
      id: fileId,
      OR: [
        { homework: { room: { members: { some: { studentId: user.id } } } } },
        { submission: { studentId: user.id } },
        { feedbackSubmission: { studentId: user.id } },
      ],
    },
  });
  return n > 0;
}
