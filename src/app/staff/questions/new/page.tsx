import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { QuestionEditor } from "../QuestionEditor";
import { saveQuestion } from "../../actions";

export default async function NewQuestionPage() {
  await requireAdmin();
  const skills = await db.skill.findMany({ orderBy: { sortOrder: "asc" } });
  return (
    <>
      <Link href="/staff/questions" className="text-sm font-semibold text-brand hover:underline">
        ← Question bank
      </Link>
      <PageHeader title="New question" />
      <QuestionEditor
        action={saveQuestion.bind(null, null)}
        skills={skills}
        initial={{ skillId: "", difficulty: "MEDIUM", type: "MCQ", stem: "", choices: {}, correctChoice: "A", sprAnswers: "", explanation: "", externalId: "" }}
      />
    </>
  );
}
