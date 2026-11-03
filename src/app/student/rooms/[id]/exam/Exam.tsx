"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import katex from "katex";
import { MathText } from "@/components/MathText";
import { cx } from "@/components/ui";
import { isValidSprInput } from "@/lib/grading";
import type { ExamResponse, ExamState } from "@/lib/exam-state";
import { saveResponse, submitModule } from "@/app/student/actions";
import { DesmosCalculator } from "./Desmos";
import { DIRECTIONS_COMMON, REFERENCE, SPR_DIRECTIONS } from "./content";
import {
  BookmarkIcon,
  CalculatorIcon,
  ChevronDown,
  ChevronUp,
  CloseIcon,
  ExpandIcon,
  FlagIcon,
  PinIcon,
  ReferenceIcon,
} from "./icons";

const EMPTY: ExamResponse = { answer: null, marked: false, eliminated: [] };
type Patch = Partial<{ answer: string | null; marked: boolean; eliminated: string[] }>;

function fmt(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function Exam({ state, studentName, calculatorAllowed }: { state: ExamState; studentName: string; calculatorAllowed: boolean }) {
  const router = useRouter();
  const { items, module } = state;
  const [idx, setIdx] = useState(() => {
    // Resume on the first unanswered question.
    const i = items.findIndex((it) => !state.responses[it.id]?.answer);
    return i === -1 ? 0 : i;
  });
  const [review, setReview] = useState(false);
  const [responses, setResponses] = useState<Record<string, ExamResponse>>(state.responses);
  const [eliminateMode, setEliminateMode] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [dirOpen, setDirOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcMounted, setCalcMounted] = useState(false);
  const [calcWide, setCalcWide] = useState(false);
  const [refOpen, setRefOpen] = useState(false);
  const [timerHidden, setTimerHidden] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState(false);

  // ── clock (server-synchronised) ──
  const offset = useMemo(() => new Date(state.serverNow).getTime() - Date.now(), [state.serverNow]);
  const deadline = new Date(state.deadline).getTime();
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + offset), 250);
    return () => clearInterval(t);
  }, [offset]);
  const remaining = deadline - now;
  const lastFive = remaining <= 5 * 60_000;

  // ── autosave ──
  const pending = useRef(new Map<string, Patch>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const inflight = useRef(new Set<Promise<unknown>>());

  const send = useCallback(
    (itemId: string) => {
      const t = timers.current.get(itemId);
      if (t) clearTimeout(t);
      timers.current.delete(itemId);
      const patch = pending.current.get(itemId);
      if (!patch) return;
      pending.current.delete(itemId);
      const p = saveResponse(state.roomId, itemId, patch)
        .then((r) => {
          if (!r.ok && r.reason === "TIME_UP") router.refresh();
          else setSaveError(!r.ok);
        })
        .catch(() => setSaveError(true))
        .finally(() => inflight.current.delete(p));
      inflight.current.add(p);
    },
    [router, state.roomId],
  );

  const flush = useCallback(async () => {
    for (const id of [...pending.current.keys()]) send(id);
    await Promise.allSettled([...inflight.current]);
  }, [send]);

  const update = useCallback(
    (itemId: string, patch: Patch, debounce = 0) => {
      setResponses((r) => ({ ...r, [itemId]: { ...EMPTY, ...r[itemId], ...patch } }));
      pending.current.set(itemId, { ...pending.current.get(itemId), ...patch });
      const t = timers.current.get(itemId);
      if (t) clearTimeout(t);
      if (debounce) timers.current.set(itemId, setTimeout(() => send(itemId), debounce));
      else send(itemId);
    },
    [send],
  );

  const finishModule = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    await flush();
    await submitModule(state.roomId, module);
    router.refresh();
  }, [flush, module, router, state.roomId, submitting]);

  // Time's up: submit automatically.
  useEffect(() => {
    if (remaining <= 0 && !submitting) void finishModule();
  }, [remaining, submitting, finishModule]);

  // Flush on tab close / navigation.
  useEffect(() => {
    const h = () => {
      for (const id of [...pending.current.keys()]) send(id);
    };
    window.addEventListener("pagehide", h);
    return () => window.removeEventListener("pagehide", h);
  }, [send]);

  const item = items[idx];
  const resp = responses[item?.id] ?? EMPTY;
  const title = `Section 1, Module ${module}: Math`;

  const go = (i: number) => {
    setReview(false);
    setIdx(i);
    setNavOpen(false);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white text-ink">
      {/* ── Header ── */}
      <header className="relative shrink-0 bg-[#f3f5fa]">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-2.5 sm:px-8">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold sm:text-lg">{title}</div>
            <button onClick={() => setDirOpen((v) => !v)} className="mt-0.5 flex items-center gap-1 text-sm font-semibold">
              Directions <ChevronDown />
            </button>
          </div>
          <div className="text-center">
            {timerHidden && !lastFive ? (
              <div className="h-7" aria-label="Timer hidden" />
            ) : (
              <div className={cx("font-mono text-xl font-bold tabular-nums sm:text-2xl", lastFive && "text-[#c13145]")} role="timer" aria-live="off">
                {fmt(remaining)}
              </div>
            )}
            {!lastFive && (
              <button
                onClick={() => setTimerHidden((v) => !v)}
                className="mt-0.5 rounded-full border border-ink/40 px-3 py-0.5 text-xs font-semibold hover:bg-white"
              >
                {timerHidden ? "Show" : "Hide"}
              </button>
            )}
          </div>
          <div className="flex items-start justify-end gap-3 sm:gap-6">
            {calculatorAllowed && (
              <button
                onClick={() => {
                  setCalcMounted(true);
                  setCalcOpen((v) => !v);
                }}
                className={cx("flex flex-col items-center text-xs font-semibold", calcOpen && "text-brand")}
              >
                <CalculatorIcon />
                <span className="mt-0.5">Calculator</span>
              </button>
            )}
            <button onClick={() => setRefOpen((v) => !v)} className={cx("flex flex-col items-center text-xs font-semibold", refOpen && "text-brand")}>
              <ReferenceIcon />
              <span className="mt-0.5">Reference</span>
            </button>
          </div>
        </div>
        <div className="bb-rule" />

        {dirOpen && (
          <div className="absolute top-full left-4 z-40 mt-2 w-[min(640px,calc(100vw-2rem))] rounded-xl border border-line bg-white shadow-2xl sm:left-8">
            <div className="max-h-[70vh] overflow-y-auto p-6 text-[15px]">
              <MathText>{DIRECTIONS_COMMON}</MathText>
              <p className="mt-3">{calculatorAllowed ? "You may use the built-in graphing calculator on any question." : "Calculator use is not permitted in this test."}</p>
              <div className="mt-4 border-t border-line pt-4">
                <MathText>{SPR_DIRECTIONS}</MathText>
              </div>
            </div>
            <div className="flex justify-end border-t border-line px-6 py-3">
              <button onClick={() => setDirOpen(false)} className="rounded-full bg-[#fedb00] px-5 py-1.5 text-sm font-bold">
                Close
              </button>
            </div>
          </div>
        )}
      </header>

      {lastFive && remaining > 0 && remaining > 5 * 60_000 - 8000 && (
        <div className="pointer-events-none absolute top-24 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white shadow-lg">
          5 minutes left in this module.
        </div>
      )}

      {/* ── Body ── */}
      <div className="relative flex min-h-0 flex-1">
        {calcMounted && (
          <aside
            className={cx("relative shrink-0 border-r border-line bg-white", !calcOpen && "hidden")}
            style={{ width: calcWide ? "min(60vw, 900px)" : "min(440px, 100vw)" }}
          >
            <div className="flex items-center justify-between border-b border-line bg-[#1e1e1e] px-3 py-1.5 text-white">
              <span className="text-sm font-semibold">Calculator</span>
              <div className="flex gap-1">
                <button className="rounded p-1 hover:bg-white/15" onClick={() => setCalcWide((v) => !v)} aria-label={calcWide ? "Collapse" : "Expand"}>
                  <ExpandIcon />
                </button>
                <button className="rounded p-1 hover:bg-white/15" onClick={() => setCalcOpen(false)} aria-label="Close calculator">
                  <CloseIcon />
                </button>
              </div>
            </div>
            <div className="h-[calc(100%-38px)]">
              <DesmosCalculator visible={calcOpen} width={calcWide ? 900 : 440} />
            </div>
          </aside>
        )}

        <main className="min-w-0 flex-1 overflow-y-auto">
          {review ? (
            <ReviewPage title={title} items={items} responses={responses} onGo={go} />
          ) : item.type === "SPR" ? (
            <div className="grid min-h-full md:grid-cols-2">
              <section className="border-b border-line px-6 py-8 md:border-r md:border-b-0 md:px-10">
                <h2 className="mb-3 text-lg font-bold">Student-produced response directions</h2>
                <MathText className="text-[15px] leading-relaxed">{SPR_DIRECTIONS}</MathText>
              </section>
              <section className="px-6 py-8 md:px-10">
                <QuestionBar
                  n={item.position}
                  marked={resp.marked}
                  onMark={() => update(item.id, { marked: !resp.marked })}
                />
                <MathText className="mt-5 font-serif text-[17px] leading-relaxed">{item.stem}</MathText>
                <SprInput key={item.id} value={resp.answer ?? ""} onChange={(v) => update(item.id, { answer: v || null }, 500)} />
              </section>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl px-6 py-8">
              <QuestionBar
                n={item.position}
                marked={resp.marked}
                onMark={() => update(item.id, { marked: !resp.marked })}
                eliminateMode={eliminateMode}
                onToggleEliminate={() => setEliminateMode((v) => !v)}
              />
              <MathText className="mt-5 font-serif text-[17px] leading-relaxed">{item.stem}</MathText>
              <div className="mt-6 space-y-3">
                {(item.choices ?? []).map((c) => {
                  const selected = resp.answer === c.key;
                  const crossed = resp.eliminated.includes(c.key);
                  return (
                    <div key={c.key} className="flex items-center gap-3">
                      <button
                        onClick={() =>
                          update(item.id, {
                            answer: c.key,
                            ...(crossed && { eliminated: resp.eliminated.filter((k) => k !== c.key) }),
                          })
                        }
                        aria-pressed={selected}
                        data-choice={c.key}
                        className={cx(
                          "relative flex min-h-12 flex-1 items-center gap-4 rounded-xl border px-4 py-2.5 text-left transition",
                          selected ? "border-[3px] border-brand px-[14px]" : "border-ink/70 hover:bg-[#f3f5fa]",
                          crossed && "text-ink/40",
                        )}
                      >
                        <span
                          className={cx(
                            "grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-sm font-bold",
                            selected ? "border-brand bg-brand text-white" : "border-ink/70",
                          )}
                        >
                          {c.key}
                        </span>
                        <MathText className="font-serif text-[16px]">{c.text}</MathText>
                        {crossed && <span className="pointer-events-none absolute inset-x-2 top-1/2 h-[2px] bg-ink/60" />}
                      </button>
                      {eliminateMode &&
                        (crossed ? (
                          <button
                            className="w-10 text-sm font-bold underline"
                            onClick={() => update(item.id, { eliminated: resp.eliminated.filter((k) => k !== c.key) })}
                          >
                            Undo
                          </button>
                        ) : (
                          <button
                            aria-label={`Cross out ${c.key}`}
                            className="relative grid h-7 w-10 place-items-center"
                            onClick={() =>
                              update(item.id, {
                                eliminated: [...resp.eliminated, c.key],
                                ...(selected && { answer: null }),
                              })
                            }
                          >
                            <span className="grid h-6 w-6 place-items-center rounded-full border border-ink text-xs font-bold">{c.key}</span>
                            <span className="absolute h-[1.5px] w-8 bg-ink" />
                          </button>
                        ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>

        {refOpen && <ReferencePanel onClose={() => setRefOpen(false)} />}
      </div>

      {/* ── Footer ── */}
      <footer className="relative shrink-0 bg-[#f3f5fa]">
        <div className="bb-rule" />
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-3 sm:px-8">
          <div className="truncate text-sm font-semibold">
            {studentName}
            {saveError && <span className="ml-3 text-xs font-medium text-[#c13145]">Connection problem: answers will retry</span>}
          </div>
          <div>
            {!review && (
              <button
                onClick={() => setNavOpen((v) => !v)}
                className="flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
              >
                Question {idx + 1} of {items.length} {navOpen ? <ChevronDown /> : <ChevronUp />}
              </button>
            )}
          </div>
          <div className="flex justify-end gap-2">
            {(review || idx > 0) && (
              <button
                onClick={() => (review ? go(items.length - 1) : setIdx(idx - 1))}
                className="rounded-full bg-brand px-6 py-2 text-sm font-bold text-white hover:bg-brand-dark"
              >
                Back
              </button>
            )}
            <button
              onClick={() => {
                if (review) setConfirming(true);
                else if (idx === items.length - 1) setReview(true);
                else setIdx(idx + 1);
              }}
              className="rounded-full bg-brand px-6 py-2 text-sm font-bold text-white hover:bg-brand-dark"
            >
              Next
            </button>
          </div>
        </div>

        {navOpen && (
          <div className="absolute bottom-full left-1/2 z-40 mb-2 w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-line bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">{title} Questions</h3>
              <button onClick={() => setNavOpen(false)} aria-label="Close">
                <CloseIcon />
              </button>
            </div>
            <Legend />
            <QuestionGrid items={items} responses={responses} current={idx} onGo={go} />
            <div className="mt-4 text-center">
              <button
                onClick={() => {
                  setReview(true);
                  setNavOpen(false);
                }}
                className="rounded-full border border-brand px-5 py-1.5 text-sm font-bold text-brand hover:bg-brand-soft"
              >
                Go to Review Page
              </button>
            </div>
          </div>
        )}
      </footer>

      {confirming && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold">{module === 1 ? "Move on to Module 2?" : "Submit your test?"}</h3>
            <p className="mt-2 text-sm text-muted">
              {module === 1
                ? "You won't be able to return to Module 1. Module 2 starts as soon as you continue."
                : "You won't be able to change your answers after submitting."}
              {(() => {
                const n = items.filter((i) => !responses[i.id]?.answer).length;
                return n ? ` You have ${n} unanswered question${n > 1 ? "s" : ""}.` : "";
              })()}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setConfirming(false)} className="rounded-full border border-ink/40 px-5 py-2 text-sm font-bold">
                Keep working
              </button>
              <button onClick={finishModule} disabled={submitting} className="rounded-full bg-brand px-5 py-2 text-sm font-bold text-white">
                {module === 1 ? "Continue" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {submitting && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-white">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-brand-soft border-t-brand" />
            <p className="mt-4 font-semibold">{module === 1 ? "Loading Module 2…" : "Submitting your answers…"}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionBar({
  n,
  marked,
  onMark,
  eliminateMode,
  onToggleEliminate,
}: {
  n: number;
  marked: boolean;
  onMark: () => void;
  eliminateMode?: boolean;
  onToggleEliminate?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b-2 border-dashed border-ink/30 bg-[#f0f0f0]">
      <span className="grid h-9 w-9 place-items-center bg-ink text-base font-bold text-white">{n}</span>
      <button onClick={onMark} className={cx("flex items-center gap-1.5 text-sm", marked ? "font-bold text-[#c13145]" : "font-medium")}>
        <BookmarkIcon filled={marked} />
        Mark for Review
      </button>
      {onToggleEliminate && (
        <button
          onClick={onToggleEliminate}
          aria-pressed={eliminateMode}
          title="Cross out answer choices"
          className={cx("relative mr-1 ml-auto rounded px-1.5 py-0.5 text-xs font-bold", eliminateMode ? "bg-brand text-white" : "border border-ink/60")}
        >
          ABC
          <span className={cx("absolute top-1/2 left-0.5 h-[1.5px] w-[calc(100%-4px)] -rotate-12", eliminateMode ? "bg-white" : "bg-ink")} />
        </button>
      )}
    </div>
  );
}

function SprInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [v, setV] = useState(value);
  const preview = useMemo(() => {
    if (!v) return "";
    const m = v.match(/^(-?)(\d*\.?\d*)\/(\d*\.?\d*)$/);
    const tex = m ? `${m[1]}\\frac{${m[2] || "\\square"}}{${m[3] || "\\square"}}` : v;
    try {
      return katex.renderToString(tex, { throwOnError: false });
    } catch {
      return v;
    }
  }, [v]);
  return (
    <div className="mt-6">
      <input
        value={v}
        inputMode="text"
        autoComplete="off"
        aria-label="Your answer"
        onChange={(e) => {
          const next = e.target.value.replace(/\s/g, "");
          if (!isValidSprInput(next)) return;
          setV(next);
          onChange(next);
        }}
        className="w-44 rounded-lg border border-ink/60 px-3 py-2 font-mono text-xl outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        style={{ borderBottomWidth: 3 }}
      />
      <div className="mt-3 text-sm">
        Answer Preview: <span className="ml-1 text-lg" dangerouslySetInnerHTML={{ __html: preview }} />
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-5 border-y border-line py-2.5 text-xs">
      <span className="flex items-center gap-1.5">
        <PinIcon /> Current
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-4 w-4 border border-dashed border-ink" /> Unanswered
      </span>
      <span className="flex items-center gap-1.5">
        <FlagIcon /> For Review
      </span>
    </div>
  );
}

function QuestionGrid({
  items,
  responses,
  current,
  onGo,
}: {
  items: ExamState["items"];
  responses: Record<string, ExamResponse>;
  current?: number;
  onGo: (i: number) => void;
}) {
  return (
    <div className="mt-4 grid grid-cols-8 gap-x-3 gap-y-4 sm:grid-cols-11">
      {items.map((it, i) => {
        const r = responses[it.id];
        const answered = !!r?.answer;
        return (
          <button key={it.id} onClick={() => onGo(i)} className="relative mx-auto" aria-label={`Question ${i + 1}`}>
            {current === i && (
              <span className="absolute -top-4 left-1/2 -translate-x-1/2">
                <PinIcon />
              </span>
            )}
            <span
              className={cx(
                "grid h-9 w-9 place-items-center text-sm font-bold",
                answered ? "bg-brand text-white" : "border border-dashed border-ink text-brand",
              )}
            >
              {i + 1}
            </span>
            {r?.marked && (
              <span className="absolute -top-1.5 -right-1.5">
                <FlagIcon />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ReviewPage({
  title,
  items,
  responses,
  onGo,
}: {
  title: string;
  items: ExamState["items"];
  responses: Record<string, ExamResponse>;
  onGo: (i: number) => void;
}) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10 text-center">
      <h1 className="text-3xl font-bold">Check Your Work</h1>
      <p className="mx-auto mt-3 max-w-xl text-[15px]">
        Once you move on, you can&apos;t return to this module. Select any question to go back to it, or select <strong>Next</strong> when you&apos;re
        ready to continue.
      </p>
      <div className="mt-8 rounded-xl p-6 text-left shadow-[0_0_0_1px_var(--color-line),0_8px_24px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">{title} Questions</h2>
        </div>
        <Legend />
        <QuestionGrid items={items} responses={responses} onGo={onGo} />
      </div>
    </div>
  );
}

function ReferencePanel({ onClose }: { onClose: () => void }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  return (
    <div
      className="absolute z-30 w-[min(460px,calc(100vw-1rem))] rounded-xl border border-line bg-white shadow-2xl"
      style={pos ? { left: pos.x, top: pos.y } : { right: 16, top: 16 }}
    >
      <div
        className="flex cursor-move items-center justify-between rounded-t-xl bg-ink px-4 py-2 text-white select-none"
        onPointerDown={(e) => {
          const box = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
          const parent = (e.currentTarget.parentElement!.parentElement as HTMLElement).getBoundingClientRect();
          drag.current = { dx: e.clientX - box.left + parent.left, dy: e.clientY - box.top + parent.top };
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => drag.current && setPos({ x: e.clientX - drag.current.dx, y: Math.max(0, e.clientY - drag.current.dy) })}
        onPointerUp={() => (drag.current = null)}
      >
        <span className="text-sm font-semibold">Reference Sheet</span>
        <button onClick={onClose} onPointerDown={(e) => e.stopPropagation()} aria-label="Close reference">
          <CloseIcon />
        </button>
      </div>
      <div className="max-h-[65vh] overflow-y-auto p-4 text-sm">
        <MathText>{REFERENCE}</MathText>
      </div>
    </div>
  );
}
