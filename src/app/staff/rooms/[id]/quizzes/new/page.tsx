import { db } from "@/lib/db";
import { Card } from "@/components/ui";
import { DEFAULT_MODULE_MINUTES } from "@/lib/blueprint";
import { QuizForm } from "../QuizForm";
import { createQuiz } from "../../../actions";

export default async function NewQuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tests = await db.test.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, title: true, source: true } });
  return (
    <Card title="New quiz">
      <QuizForm
        action={createQuiz.bind(null, id)}
        tests={tests}
        submitLabel="Create quiz"
        withSchedule
        initial={{ title: "", moduleMinutes: DEFAULT_MODULE_MINUTES, calculatorAllowed: true, testId: null }}
      />
    </Card>
  );
}
