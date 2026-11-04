"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Badge, Button, Notice, Table } from "@/components/ui";
import { bulkQuestions, type BulkTarget } from "../actions";
import type { QuestionFilters } from "@/lib/question-filters";

export type Row = { id: string; stem: string; domain: string; skill: string; difficulty: string; type: string; active: boolean };

/** Question list with checkboxes and bulk actions (admins). */
export function QuestionTable({ rows, total, filters, canEdit }: { rows: Row[]; total: number; filters: QuestionFilters; canEdit: boolean }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ message?: string; error?: string }>();
  const pageAll = rows.length > 0 && rows.every((r) => sel.has(r.id));
  const count = allMatching ? total : sel.size;

  const run = (op: "activate" | "deactivate" | "delete") => {
    const target: BulkTarget = allMatching ? { filters } : { ids: [...sel] };
    const verb = op === "delete" ? "Delete" : op === "activate" ? "Activate" : "Deactivate";
    if (!window.confirm(`${verb} ${count} question${count === 1 ? "" : "s"}?${op === "delete" ? " This can't be undone." : ""}`)) return;
    start(async () => {
      setResult(await bulkQuestions(target, op));
      setSel(new Set());
      setAllMatching(false);
    });
  };

  const toggle = (id: string, on: boolean) => {
    const n = new Set(sel);
    if (on) n.add(id);
    else n.delete(id);
    setSel(n);
    setAllMatching(false);
  };

  return (
    <div className="space-y-3">
      {canEdit && (sel.size > 0 || allMatching) && (
        <div className="anim-fade sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-brand/30 bg-brand-soft px-4 py-2.5 text-sm shadow-sm">
          <span className="font-semibold">
            {count.toLocaleString()} selected{allMatching && " (everything matching the filter)"}
          </span>
          {pageAll && !allMatching && total > rows.length && (
            <button className="font-semibold text-brand underline" onClick={() => setAllMatching(true)}>
              Select all {total.toLocaleString()} matching
            </button>
          )}
          <span className="ml-auto flex flex-wrap gap-2">
            <Button pending={pending} onClick={() => run("activate")}>
              Activate
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => run("deactivate")}>
              Deactivate
            </Button>
            <Button variant="danger" disabled={pending} onClick={() => run("delete")}>
              Delete
            </Button>
            <Button variant="ghost" disabled={pending} onClick={() => (setSel(new Set()), setAllMatching(false))}>
              Clear
            </Button>
          </span>
        </div>
      )}
      {result?.message && <Notice tone="ok">{result.message}</Notice>}
      {result?.error && <Notice tone="bad">{result.error}</Notice>}
      <Table>
        <thead>
          <tr>
            {canEdit && (
              <th className="w-8">
                <input
                  type="checkbox"
                  aria-label="Select all on this page"
                  checked={pageAll}
                  onChange={(e) => {
                    setSel(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set());
                    setAllMatching(false);
                  }}
                />
              </th>
            )}
            <th>Question</th>
            <th>Domain / skill</th>
            <th>Difficulty</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((q) => (
            <tr key={q.id} className={`${q.active ? "" : "opacity-70"} ${sel.has(q.id) || allMatching ? "bg-brand-soft/50" : ""}`}>
              {canEdit && (
                <td>
                  <input type="checkbox" aria-label="Select question" checked={allMatching || sel.has(q.id)} onChange={(e) => toggle(q.id, e.target.checked)} />
                </td>
              )}
              <td className="max-w-md">
                <Link href={`/staff/questions/${q.id}`} className="line-clamp-2 text-brand hover:underline">
                  {q.stem}
                </Link>
              </td>
              <td>
                <div className="font-medium">{q.domain}</div>
                <div className="text-xs text-muted">{q.skill}</div>
              </td>
              <td>{q.difficulty}</td>
              <td>
                <span className="flex flex-wrap gap-1">
                  {q.type === "MCQ" ? "MCQ" : <Badge tone="warn">SPR</Badge>}
                  {!q.active && <Badge>Inactive</Badge>}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
