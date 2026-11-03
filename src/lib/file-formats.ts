/** File formats a professor can require for a homework. Pure (client + server). */

export const FORMAT_PRESETS: { key: string; label: string; exts: string[] }[] = [
  { key: "pdf", label: "PDF", exts: ["pdf"] },
  { key: "image", label: "Images (JPG, PNG, HEIC, WebP)", exts: ["jpg", "jpeg", "png", "heic", "webp"] },
  { key: "word", label: "Word (DOC, DOCX)", exts: ["doc", "docx"] },
  { key: "excel", label: "Excel (XLS, XLSX, CSV)", exts: ["xls", "xlsx", "csv"] },
  { key: "pptx", label: "PowerPoint (PPT, PPTX)", exts: ["ppt", "pptx"] },
  { key: "text", label: "Text (TXT)", exts: ["txt"] },
  { key: "zip", label: "ZIP archive", exts: ["zip"] },
];

export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_FILES_PER_UPLOAD = 10;
export const MAX_UPLOAD_BYTES = 40 * 1024 * 1024;

export function extOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i < 0 ? "" : filename.slice(i + 1).toLowerCase();
}

/** "pdf, .DOCX , png" → ["pdf", "docx", "png"] */
export function parseExtensions(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[\s,;]+/)
        .map((s) => s.trim().replace(/^\./, "").toLowerCase())
        .filter((s) => /^[a-z0-9]{1,10}$/.test(s)),
    ),
  ];
}

export function formatsLabel(exts: string[]): string {
  return exts.length ? exts.map((e) => e.toUpperCase()).join(", ") : "Any file type";
}

/** Value for <input type="file" accept>. */
export function acceptAttr(exts: string[]): string | undefined {
  return exts.length ? exts.map((e) => `.${e}`).join(",") : undefined;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** MIME type we serve a stored file with, decided by extension (never by the uploader). */
const MIME: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip",
};
export const mimeFor = (filename: string) => MIME[extOf(filename)] ?? "application/octet-stream";

/** Formats the browser may display inline (everything else downloads). */
export const INLINE_EXTS = new Set(["pdf", "jpg", "jpeg", "png", "webp", "gif", "txt"]);
