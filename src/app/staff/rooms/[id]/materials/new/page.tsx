import { Card } from "@/components/ui";
import { MaterialForm } from "../MaterialForm";
import { createMaterial } from "../../../actions";

export default async function NewMaterialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Card title="Post lecture material">
      <MaterialForm action={createMaterial.bind(null, id)} submitLabel="Post" initial={{ title: "", description: "", url: "" }} />
    </Card>
  );
}
