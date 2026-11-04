import { Card } from "@/components/ui";
import { HomeworkForm } from "../HomeworkForm";
import { createHomework } from "../../../actions";

export default async function NewHomeworkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Card title="New homework">
      <HomeworkForm
        action={createHomework.bind(null, id)}
        submitLabel="Assign homework"
        initial={{ title: "", instructions: "", maxPoints: 100, allowLate: false, allowedFormats: ["pdf", "jpg", "jpeg", "png", "heic", "webp"] }}
      />
    </Card>
  );
}
