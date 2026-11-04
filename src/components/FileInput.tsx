"use client";
import { useState } from "react";
import { MAX_FILES_PER_UPLOAD, MAX_FILE_BYTES, acceptAttr, extOf, formatBytes, formatsLabel } from "@/lib/file-formats";

/** Multi-file picker that checks format and size before upload (the server re-checks). */
export function FileInput({
  name,
  formats = [],
  required,
  maxFileBytes = MAX_FILE_BYTES,
}: {
  name: string;
  formats?: string[];
  required?: boolean;
  maxFileBytes?: number;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const problems = files.flatMap((f) => [
    ...(formats.length && !formats.includes(extOf(f.name)) ? [`${f.name}: not an accepted format`] : []),
    ...(f.size > maxFileBytes ? [`${f.name}: larger than ${formatBytes(maxFileBytes)}`] : []),
  ]);
  if (files.length > MAX_FILES_PER_UPLOAD) problems.push(`Choose at most ${MAX_FILES_PER_UPLOAD} files`);
  return (
    <div className="space-y-1.5">
      <input
        type="file"
        name={name}
        multiple
        required={required}
        accept={acceptAttr(formats)}
        onChange={(e) => setFiles([...(e.target.files ?? [])])}
        className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-semibold hover:file:bg-canvas"
      />
      <p className="text-xs text-muted">
        Accepted: {formatsLabel(formats)} · up to {MAX_FILES_PER_UPLOAD} files, {formatBytes(maxFileBytes)} each
      </p>
      {problems.map((p) => (
        <p key={p} className="text-xs text-bad">
          {p}
        </p>
      ))}
    </div>
  );
}
