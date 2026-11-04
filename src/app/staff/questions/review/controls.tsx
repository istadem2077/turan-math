"use client";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Notice, Select, cx } from "@/components/ui";
import { DOMAIN_LABEL } from "@/lib/taxonomy";
import { reviewQuestion } from "../../actions";

type Difficulty = "EASY" | "MEDIUM" | "HARD";
const DIFFS: [Difficulty, string, string][] = [
  ["EASY", "Easy", "1"],
  ["MEDIUM", "Medium", "2"],
  ["HARD", "Hard", "3"],
];

export function ReviewControls({
  question,
  skills,
  nextUrl,
}: {
  question: { id: string; skillId: number; difficulty: Difficulty };
  skills: { id: number; name: string; domain: string }[];
  nextUrl: string;
}) {
  const router = useRouter();
  const [skillId, setSkillId] = useState(question.skillId);
  const [difficulty, setDifficulty] = useState<Difficulty>(question.difficulty);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  // Load the next question in the background so moving on is instant.
  useEffect(() => router.prefetch(nextUrl), [router, nextUrl]);

  const decide = useCallback(
    (decision: "activate" | "skip" | "delete") => {
      if (pending) return;
      setError(undefined);
      start(async () => {
        const r = await reviewQuestion(question.id, decision, { skillId, difficulty });
        if (r.error) setError(r.error);
        else router.replace(nextUrl, { scroll: false });
      });
    },
    [pending, question.id, skillId, difficulty, router, nextUrl],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      const k = e.key.toLowerCase();
      if (k === "a") decide("activate");
      else if (k === "s" || k === "arrowright") decide("skip");
      else if (k === "d") {
        if (window.confirm("Delete this question?")) decide("delete");
      } else if (k === "e") window.open(`/staff/questions/${question.id}`, "_blank");
      else {
        const d = DIFFS.find(([, , key]) => key === k);
        if (d) setDifficulty(d[0]);
        else return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decide, question.id]);

  const domains = [...new Set(skills.map((s) => s.domain))];
  return (
    <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
      <Card title="Decision">
        <div className="space-y-4">
          <Field label="Skill">
            <Select value={skillId} onChange={(e) => setSkillId(Number(e.target.value))}>
              {domains.map((d) => (
                <optgroup key={d} label={DOMAIN_LABEL[d as keyof typeof DOMAIN_LABEL]}>
                  {skills
                    .filter((s) => s.domain === d)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </Select>
          </Field>
          <div>
            <span className="text-sm font-medium">Difficulty</span>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              {DIFFS.map(([d, label, key]) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className={cx(
                    "rounded-lg border px-2 py-1.5 text-sm font-semibold transition",
                    difficulty === d ? "border-brand bg-brand text-white" : "border-line bg-white hover:bg-canvas",
                  )}
                >
                  {label} <kbd className="ml-1 text-xs opacity-60">{key}</kbd>
                </button>
              ))}
            </div>
          </div>
          {error && <Notice tone="bad">{error}</Notice>}
          <div className="grid gap-2">
            <Button pending={pending} onClick={() => decide("activate")}>
              Activate <kbd className="text-xs opacity-70">A</kbd>
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => decide("skip")}>
              Skip, keep inactive <kbd className="text-xs opacity-60">S</kbd>
            </Button>
            <Button variant="danger" disabled={pending} onClick={() => window.confirm("Delete this question?") && decide("delete")}>
              Delete <kbd className="text-xs opacity-60">D</kbd>
            </Button>
          </div>
          <p className="text-xs text-muted">
            Skill and difficulty changes are saved with your decision. <kbd>E</kbd> opens the full editor in a new tab.
          </p>
        </div>
      </Card>
    </div>
  );
}
