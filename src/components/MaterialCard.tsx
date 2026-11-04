import type { ReactNode } from "react";
import { LocalTime } from "./LocalTime";
import { MathText } from "./MathText";
import { FileList } from "./FileList";
import type { FileMeta } from "@/lib/files";

export type MaterialView = {
  id: string;
  title: string;
  description: string;
  url: string | null;
  createdAt: Date;
  files: FileMeta[];
};

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** A lecture material: description, files to open/download, and an external link. */
export function MaterialCard({ m, actions }: { m: MaterialView; actions?: ReactNode }) {
  return (
    <article className="rounded-xl border border-line bg-white p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{m.title}</h3>
          <p className="text-xs text-muted">
            Posted <LocalTime iso={m.createdAt.toISOString()} mode="date" />
          </p>
        </div>
        {actions}
      </header>
      {(m.description || m.files.length > 0 || m.url) && (
        <div className="mt-4 space-y-3">
          {m.description && <MathText className="text-sm">{m.description}</MathText>}
          <FileList files={m.files} />
          {m.url && (
            <a
              href={m.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-sm transition hover:border-brand"
            >
              <span className="min-w-0 truncate font-medium text-brand">🔗 {host(m.url)}</span>
              <span className="shrink-0 text-xs font-semibold text-brand">Open link ↗</span>
            </a>
          )}
        </div>
      )}
    </article>
  );
}
