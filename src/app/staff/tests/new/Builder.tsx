"use client";
import { useEffect, useState, useTransition } from "react";
import { Badge, Button, Input, Notice, Select, cx } from "@/components/ui";
import { MathText } from "@/components/MathText";
import { DIFFICULTIES, DIFFICULTY_LABEL, DOMAINS, DOMAIN_LABEL, DOMAIN_SHORT } from "@/lib/taxonomy";
import { BLUEPRINT, QUESTIONS_PER_MODULE } from "@/lib/blueprint";
import { saveManualTest, searchQuestions } from "../../actions";
import type { Difficulty, Domain, QuestionType } from "@/generated/prisma/enums";

export type PickedQuestion = { id: string; domain: Domain; difficulty: Difficulty; type: QuestionType; skill: string; stem: string };
type SearchResult = Awaited<ReturnType<typeof searchQuestions>>;

const DIFF_TONE = { EASY: "ok", MEDIUM: "warn", HARD: "bad" } as const;

function strip(md: string) {
  return md.replace(/\$\$?([^$]*)\$\$?/g, "$1").replace(/[*_#>`]/g, "").slice(0, 110);
}

export function Builder({
  skills,
  initial,
  initialTitle,
}: {
  skills: { id: number; name: string; domain: Domain }[];
  initial: PickedQuestion[][];
  initialTitle: string;
}) {
  const [modules, setModules] = useState<PickedQuestion[][]>(initial);
  const [title, setTitle] = useState(initialTitle);
  const [filters, setFilters] = useState({ domain: "", skillId: "", difficulty: "", type: "", q: "" });
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<SearchResult>();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [saving, startSave] = useTransition();
  const [error, setError] = useState<string>();

  const pickedIds = modules.flat().map((q) => q.id);

  useEffect(() => {
    const t = setTimeout(
      () =>
        startSearch(async () => {
          setResult(
            await searchQuestions({
              domain: filters.domain || undefined,
              skillId: filters.skillId ? Number(filters.skillId) : undefined,
              difficulty: filters.difficulty || undefined,
              type: filters.type || undefined,
              q: filters.q || undefined,
              page,
              exclude: pickedIds,
            }),
          );
        }),
      250,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page, pickedIds.join(",")]);

  const set = (k: keyof typeof filters, v: string) => {
    setPage(1);
    setFilters((f) => ({ ...f, [k]: v, ...(k === "domain" ? { skillId: "" } : {}) }));
  };

  const add = (m: number, q: SearchResult["rows"][number]) =>
    setModules((ms) =>
      ms.map((list, i) =>
        i === m && list.length < QUESTIONS_PER_MODULE
          ? [...list, { id: q.id, domain: q.domain, difficulty: q.difficulty, type: q.type, skill: q.skill, stem: q.stem }]
          : list,
      ),
    );
  const remove = (m: number, idx: number) => setModules((ms) => ms.map((l, i) => (i === m ? l.filter((_, j) => j !== idx) : l)));
  const moveItem = (m: number, idx: number, d: -1 | 1) =>
    setModules((ms) =>
      ms.map((l, i) => {
        if (i !== m || idx + d < 0 || idx + d >= l.length) return l;
        const n = [...l];
        [n[idx], n[idx + d]] = [n[idx + d], n[idx]];
        return n;
      }),
    );
  const sortByDifficulty = (m: number) =>
    setModules((ms) => ms.map((l, i) => (i === m ? [...l].sort((a, b) => DIFFICULTIES.indexOf(a.difficulty) - DIFFICULTIES.indexOf(b.difficulty)) : l)));

  const complete = modules.every((l) => l.length === QUESTIONS_PER_MODULE);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* Bank search */}
      <section className="rounded-xl border border-line bg-white">
        <div className="grid gap-2 border-b border-line p-4 sm:grid-cols-2">
          <Select value={filters.domain} onChange={(e) => set("domain", e.target.value)}>
            <option value="">All domains</option>
            {DOMAINS.map((d) => (
              <option key={d} value={d}>
                {DOMAIN_LABEL[d]}
              </option>
            ))}
          </Select>
          <Select value={filters.skillId} onChange={(e) => set("skillId", e.target.value)}>
            <option value="">All skills</option>
            {skills
              .filter((s) => !filters.domain || s.domain === filters.domain)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </Select>
          <Select value={filters.difficulty} onChange={(e) => set("difficulty", e.target.value)}>
            <option value="">All difficulties</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_LABEL[d]}
              </option>
            ))}
          </Select>
          <Select value={filters.type} onChange={(e) => set("type", e.target.value)}>
            <option value="">All types</option>
            <option value="MCQ">Multiple choice</option>
            <option value="SPR">Student-produced response</option>
          </Select>
          <Input className="sm:col-span-2" placeholder="Search question text…" value={filters.q} onChange={(e) => set("q", e.target.value)} />
        </div>
        <div className="flex items-center justify-between px-4 py-2 text-xs text-muted">
          <span>{result ? `${result.total.toLocaleString()} questions` : "Loading…"}</span>
          {searching && <span>Searching…</span>}
        </div>
        <ul className="divide-y divide-line">
          {result?.rows.map((q) => (
            <li key={q.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone="brand">{DOMAIN_SHORT[q.domain]}</Badge>
                <Badge tone={DIFF_TONE[q.difficulty]}>{DIFFICULTY_LABEL[q.difficulty]}</Badge>
                {q.type === "SPR" && <Badge>SPR</Badge>}
                <span className="truncate text-xs text-muted">{q.skill}</span>
              </div>
              <button type="button" className="mt-2 block w-full text-left text-sm" onClick={() => setExpanded(expanded === q.id ? null : q.id)}>
                {expanded === q.id ? (
                  <div className="rounded-lg bg-canvas p-3">
                    <MathText className="font-serif">{q.stem}</MathText>
                    {q.choices && (
                      <ul className="mt-2 space-y-1">
                        {q.choices.map((c) => (
                          <li key={c.key} className={cx("flex gap-2", c.key === q.correctChoice && "font-semibold text-ok")}>
                            {c.key}. <MathText>{c.text}</MathText>
                          </li>
                        ))}
                      </ul>
                    )}
                    {q.type === "SPR" && <p className="mt-2 text-ok">Answer: {q.sprAnswers.join(", ")}</p>}
                  </div>
                ) : (
                  <span className="line-clamp-2 text-ink">{strip(q.stem)}…</span>
                )}
              </button>
              <div className="mt-2 flex gap-2">
                {[0, 1].map((m) => (
                  <Button key={m} variant="secondary" className="px-2.5 py-1 text-xs" disabled={modules[m].length >= QUESTIONS_PER_MODULE} onClick={() => add(m, q)}>
                    + Module {m + 1}
                  </Button>
                ))}
              </div>
            </li>
          ))}
          {result && result.rows.length === 0 && <li className="p-6 text-center text-sm text-muted">No questions match these filters.</li>}
        </ul>
        {result && result.pages > 1 && (
          <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="text-muted">
              Page {page} of {result.pages}
            </span>
            <Button variant="secondary" disabled={page >= result.pages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        )}
      </section>

      {/* Selected */}
      <section className="space-y-4 xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto">
        <div className="rounded-xl border border-line bg-white p-4">
          <Input placeholder="Test title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          <div className="mt-3 flex items-center gap-3">
            <Button
              disabled={!complete || !title.trim() || saving}
              onClick={() =>
                startSave(async () => {
                  setError(undefined);
                  const res = await saveManualTest(title, modules.map((l) => l.map((q) => q.id)));
                  if (res?.error) setError(res.error);
                })
              }
            >
              {saving ? "Saving…" : "Save test"}
            </Button>
            <span className="text-sm text-muted">
              {modules[0].length + modules[1].length}/44 selected
            </span>
          </div>
          {error && <div className="mt-3"><Notice tone="bad">{error}</Notice></div>}
        </div>
        {modules.map((list, m) => (
          <div key={m} className="rounded-xl border border-line bg-white">
            <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <h3 className="font-semibold">
                Module {m + 1} <span className="font-normal text-muted">· {list.length}/22</span>
              </h3>
              <button type="button" className="text-xs font-semibold text-brand hover:underline" onClick={() => sortByDifficulty(m)}>
                Sort easy → hard
              </button>
            </header>
            <div className="flex flex-wrap gap-x-3 gap-y-1 border-b border-line px-4 py-2 text-xs text-muted">
              {DOMAINS.map((d) => {
                const n = list.filter((q) => q.domain === d).length;
                const target = BLUEPRINT[m].domains[d];
                return (
                  <span key={d} className={n === target ? "text-ok" : ""}>
                    {DOMAIN_SHORT[d]} {n}/{target}
                  </span>
                );
              })}
            </div>
            <ol className="divide-y divide-line">
              {list.map((q, i) => (
                <li key={q.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="w-6 text-right font-semibold">{i + 1}</span>
                  <Badge tone={DIFF_TONE[q.difficulty]}>{q.difficulty[0]}</Badge>
                  <span className="w-20 shrink-0 truncate text-xs text-muted">{DOMAIN_SHORT[q.domain]}</span>
                  <span className="min-w-0 flex-1 truncate">{strip(q.stem)}</span>
                  <button type="button" aria-label="Move up" className="px-1 text-muted hover:text-ink" onClick={() => moveItem(m, i, -1)}>
                    ↑
                  </button>
                  <button type="button" aria-label="Move down" className="px-1 text-muted hover:text-ink" onClick={() => moveItem(m, i, 1)}>
                    ↓
                  </button>
                  <button type="button" aria-label="Remove" className="px-1 text-bad" onClick={() => remove(m, i)}>
                    ✕
                  </button>
                </li>
              ))}
              {list.length === 0 && <li className="p-4 text-center text-sm text-muted">Add questions from the bank.</li>}
            </ol>
          </div>
        ))}
      </section>
    </div>
  );
}
