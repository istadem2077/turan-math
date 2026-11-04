import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { SKILLS } from "@/lib/taxonomy";
import { ImportForm } from "./ImportForm";

const JSON_EXAMPLE = `[
  {
    "externalId": "cb-000123",
    "domain": "ALGEBRA",
    "skill": "LIN_EQ_1VAR",
    "difficulty": "MEDIUM",
    "type": "MCQ",
    "stem": "If $3x + 5 = 20$, what is the value of $x$?",
    "choices": { "A": "$3$", "B": "$5$", "C": "$15$", "D": "$25$" },
    "answer": "B",
    "explanation": "Subtract 5, then divide by 3."
  },
  {
    "domain": "ADVANCED_MATH",
    "skill": "Nonlinear functions",
    "difficulty": "H",
    "type": "SPR",
    "stem": "If $x > 0$ and $4x^2 = 9$, what is the value of $x$?",
    "answer": ["3/2", "1.5"]
  }
]`;

export default async function ImportPage() {
  await requireAdmin();
  return (
    <>
      <Link href="/staff/questions" className="text-sm font-semibold text-brand hover:underline">
        ← Question bank
      </Link>
      <PageHeader title="Import questions" subtitle="Upload JSON or CSV. Rows whose externalId already exists are skipped, so re-uploading is safe." />
      <div className="space-y-6">
        <Card>
          <ImportForm />
          <p className="mt-4 text-xs text-muted">
            For very large files (100k+ rows) use the command line: <code className="rounded bg-canvas px-1">npx tsx scripts/import-questions.ts file.json</code>
          </p>
        </Card>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="JSON format">
            <pre className="overflow-x-auto rounded-lg bg-canvas p-3 text-xs">{JSON_EXAMPLE}</pre>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted">
              <li>domain: ALGEBRA, ADVANCED_MATH, PROBLEM_SOLVING_DATA_ANALYSIS (or PSDA), GEOMETRY_TRIGONOMETRY</li>
              <li>difficulty: EASY/MEDIUM/HARD or E/M/H · type: MCQ or SPR</li>
              <li>skill: code or full name (list on the right)</li>
              <li>MCQ answer: A–D. SPR answer: string or array; equivalent fractions/decimals are accepted automatically.</li>
              <li>Text is Markdown with LaTeX math between $…$; images as ![](https://…)</li>
            </ul>
          </Card>
          <Card title="CSV columns & skills">
            <code className="block rounded-lg bg-canvas p-3 text-xs">externalId,domain,skill,difficulty,type,stem,choiceA,choiceB,choiceC,choiceD,answer,explanation</code>
            <p className="mt-2 text-xs text-muted">For SPR rows leave choices empty and separate accepted answers with |.</p>
            <table className="mt-3 w-full text-xs">
              <tbody>
                {SKILLS.map((s) => (
                  <tr key={s.code} className="border-t border-line">
                    <td className="py-1 pr-2 font-mono">{s.code}</td>
                    <td className="py-1 text-muted">{s.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </>
  );
}
