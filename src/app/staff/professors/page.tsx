import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { Badge, Card, PageHeader, Table } from "@/components/ui";
import { ActionButton, CreateUserForm, ResetPasswordButton } from "@/components/client-ui";
import { createProfessor, resetPassword, setUserActive } from "../actions";

export default async function ProfessorsPage() {
  await requireAdmin();
  const profs = await db.user.findMany({ where: { role: "PROFESSOR" }, orderBy: { fullName: "asc" } });
  return (
    <>
      <PageHeader title="Professors" subtitle="Professors can manage students, rooms and tests. Only administrators can edit the question bank." />
      <div className="space-y-6">
        <Card title="Create a professor">
          <CreateUserForm action={createProfessor} noun="professor" />
        </Card>
        {profs.length > 0 && (
          <Table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {profs.map((p) => (
                <tr key={p.id} className="align-top">
                  <td className="font-medium">
                    {p.fullName} {!p.active && <Badge tone="bad">Deactivated</Badge>}
                  </td>
                  <td className="text-muted">@{p.username}</td>
                  <td>
                    <div className="flex flex-wrap items-start gap-2">
                      <ResetPasswordButton action={resetPassword.bind(null, p.id)} />
                      {p.active ? (
                        <ActionButton variant="danger" action={setUserActive.bind(null, p.id, false)} confirm="Deactivate this professor?">
                          Deactivate
                        </ActionButton>
                      ) : (
                        <ActionButton action={setUserActive.bind(null, p.id, true)}>Reactivate</ActionButton>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </>
  );
}
