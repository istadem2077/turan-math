"use client";
import { useActionState, useRef, useState } from "react";
import { Button, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { MathText } from "@/components/MathText";
import { DIFFICULTIES, DIFFICULTY_LABEL, DOMAINS, DOMAIN_LABEL, MCQ_KEYS } from "@/lib/taxonomy";
import { uploadAsset, type ActionResult } from "../actions";
import type { Domain } from "@/generated/prisma/enums";

export type QuestionValues = {
  skillId: number | "";
  difficulty: string;
  type: "MCQ" | "SPR";
  stem: string;
  choices: Record<string, string>;
  correctChoice: string;
  sprAnswers: string;
  explanation: string;
  externalId: string;
};

export function QuestionEditor({
  action,
  skills,
  initial,
}: {
  action: (s: ActionResult | undefined, f: FormData) => Promise<ActionResult>;
  skills: { id: number; name: string; domain: Domain }[];
  initial: QuestionValues;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [v, setV] = useState(initial);
  const [uploadMsg, setUploadMsg] = useState<string>();
  const stemRef = useRef<HTMLTextAreaElement>(null);
  const up = <K extends keyof QuestionValues>(k: K, val: QuestionValues[K]) => setV((s) => ({ ...s, [k]: val }));

  async function onUpload(file: File) {
    const fd = new FormData();
    fd.set("file", file);
    setUploadMsg("Uploading…");
    const res = await uploadAsset(fd);
    if (res.error) return setUploadMsg(res.error);
    const md = `\n\n![figure](${res.url})\n\n`;
    const el = stemRef.current;
    const pos = el?.selectionStart ?? v.stem.length;
    up("stem", v.stem.slice(0, pos) + md + v.stem.slice(pos));
    setUploadMsg("Image inserted into the question text.");
  }

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Skill" className="sm:col-span-2">
            <Select name="skillId" value={v.skillId} onChange={(e) => up("skillId", Number(e.target.value))} required>
              <option value="">Choose a skill…</option>
              {DOMAINS.map((d) => (
                <optgroup key={d} label={DOMAIN_LABEL[d]}>
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
          <Field label="Difficulty">
            <Select name="difficulty" value={v.difficulty} onChange={(e) => up("difficulty", e.target.value)}>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {DIFFICULTY_LABEL[d]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Type">
            <Select name="type" value={v.type} onChange={(e) => up("type", e.target.value as "MCQ" | "SPR")}>
              <option value="MCQ">Multiple choice</option>
              <option value="SPR">Student-produced response</option>
            </Select>
          </Field>
        </div>
        <Field label="Question" hint="Markdown. Math: $x^2$ inline, $$\frac{a}{b}$$ display. Tables use Markdown pipes.">
          <Textarea ref={stemRef} name="stem" rows={8} value={v.stem} onChange={(e) => up("stem", e.target.value)} required />
        </Field>
        <div className="flex items-center gap-3 text-sm">
          <label className="cursor-pointer font-semibold text-brand hover:underline">
            Upload figure
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
          </label>
          {uploadMsg && <span className="text-muted">{uploadMsg}</span>}
        </div>
        {v.type === "MCQ" ? (
          <div className="space-y-2">
            <span className="text-sm font-medium">Choices (select the correct one)</span>
            {MCQ_KEYS.map((k) => (
              <div key={k} className="flex items-center gap-2">
                <input type="radio" name="correctChoice" value={k} checked={v.correctChoice === k} onChange={() => up("correctChoice", k)} aria-label={`${k} is correct`} />
                <span className="w-4 font-bold">{k}</span>
                <Input name={`choice${k}`} value={v.choices[k] ?? ""} onChange={(e) => up("choices", { ...v.choices, [k]: e.target.value })} required />
              </div>
            ))}
          </div>
        ) : (
          <Field label="Accepted answers" hint="Separate with |, e.g. 3/2|1.5. Equivalent fractions/decimals are accepted automatically.">
            <Input name="sprAnswers" value={v.sprAnswers} onChange={(e) => up("sprAnswers", e.target.value)} required />
          </Field>
        )}
        <Field label="Explanation (optional)">
          <Textarea name="explanation" rows={4} value={v.explanation} onChange={(e) => up("explanation", e.target.value)} />
        </Field>
        <Field label="External ID (optional)" hint="Your source's ID; used to skip duplicates on import.">
          <Input name="externalId" value={v.externalId} onChange={(e) => up("externalId", e.target.value)} />
        </Field>
        {state?.error && <Notice tone="bad">{state.error}</Notice>}
        <Button pending={pending}>{"Save question"}</Button>
      </div>
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="text-sm font-medium">Preview</div>
        <div className="mt-1.5 rounded-xl border border-line bg-white p-6">
          <MathText className="font-serif text-[17px] leading-relaxed">{v.stem || "_Question text…_"}</MathText>
          {v.type === "MCQ" ? (
            <div className="mt-4 space-y-2">
              {MCQ_KEYS.map((k) => (
                <div key={k} className={`flex items-center gap-3 rounded-lg border-2 px-3 py-2 ${v.correctChoice === k ? "border-ok" : "border-ink/70"}`}>
                  <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-ink/70 text-xs font-bold">{k}</span>
                  <MathText>{v.choices[k] || " "}</MathText>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-ok">Accepted: {v.sprAnswers}</p>
          )}
          {v.explanation && (
            <div className="mt-4 rounded-lg bg-canvas p-3 text-sm">
              <MathText>{v.explanation}</MathText>
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
