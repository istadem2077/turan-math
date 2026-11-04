import { MathText } from "./MathText";
import type { Choice } from "@/lib/taxonomy";

/** A question as students see it, with the answer key marked (staff only). */
export function QuestionPreview({
  q,
}: {
  q: { type: string; stem: string; choices: unknown; correctChoice: string | null; sprAnswers: string[]; explanation: string | null };
}) {
  const choices = (q.choices as Choice[] | null) ?? [];
  return (
    <div className="space-y-4">
      <MathText className="font-serif text-[17px] leading-relaxed">{q.stem}</MathText>
      {q.type === "MCQ" ? (
        <div className="space-y-2">
          {choices.map((c) => (
            <div
              key={c.key}
              className={`flex items-center gap-3 rounded-lg border-2 px-3 py-2 ${q.correctChoice === c.key ? "border-ok bg-ok-soft" : "border-ink/30"}`}
            >
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-sm font-bold ${q.correctChoice === c.key ? "border-ok bg-ok text-white" : "border-ink/60"}`}>
                {c.key}
              </span>
              <MathText>{c.text}</MathText>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border-2 border-ok bg-ok-soft px-3 py-2 text-sm font-semibold text-ok">Accepted answer: {q.sprAnswers.join("  |  ")}</p>
      )}
      {q.explanation && (
        <details className="rounded-lg bg-canvas p-3 text-sm">
          <summary className="cursor-pointer font-semibold text-muted">Explanation</summary>
          <MathText className="mt-2">{q.explanation}</MathText>
        </details>
      )}
    </div>
  );
}
