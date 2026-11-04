import { formatBytes } from "@/lib/file-formats";
import type { FileMeta } from "@/lib/files";
import { ActionButton } from "./client-ui";

/** Download links for stored files; `onDelete` adds a remove button per file. */
export function FileList({ files, onDelete }: { files: FileMeta[]; onDelete?: (id: string) => () => Promise<unknown> }) {
  if (files.length === 0) return null;
  return (
    <ul className="divide-y divide-line rounded-lg border border-line">
      {files.map((f) => (
        <li key={f.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <a href={`/api/files/${f.id}`} target="_blank" rel="noopener" className="min-w-0 truncate font-medium text-brand hover:underline">
            📎 {f.filename}
          </a>
          <span className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-muted">{formatBytes(f.size)}</span>
            <a href={`/api/files/${f.id}?download`} className="text-xs font-semibold text-brand hover:underline">
              Download
            </a>
            {onDelete && (
              <ActionButton variant="ghost" action={onDelete(f.id)} confirm={`Remove ${f.filename}?`}>
                Remove
              </ActionButton>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
