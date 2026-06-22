import { AdminActionForm } from "../_action-form";
import { AdminPageHeader, AdminTable, ShortId, StatusPill } from "../_components";
import { searchAdminUsers } from "@/server/services/admin-service";

export default async function AdminUsersPage({
  searchParams
}: {
  searchParams?: { q?: string };
}) {
  const users = await searchAdminUsers(searchParams?.q);

  return (
    <>
      <AdminPageHeader
        title="Users"
        description="Search customer and admin accounts, inspect profile readiness, and grant report credits."
        action={
          <form className="admin-search">
            <input name="q" placeholder="Search email" defaultValue={searchParams?.q ?? ""} />
            <button type="submit">Search</button>
          </form>
        }
      />
      <AdminTable
        columns={[
          { key: "id", label: "ID" },
          { key: "email", label: "Email" },
          { key: "role", label: "Role" },
          { key: "status", label: "Status" },
          { key: "profile", label: "Profile" },
          { key: "credits", label: "Credits" },
          { key: "subscriptions", label: "Subs" },
          { key: "action", label: "Add credit" }
        ]}
        rows={users.map((user) => ({
          id: <ShortId value={user.id} />,
          email: user.email,
          role: user.role,
          status: <StatusPill value={user.status} />,
          profile: user.profile_score ?? "n/a",
          credits: user.credits_total,
          subscriptions: user.active_subscriptions,
          action: (
            <AdminActionForm
              endpoint={`/api/admin/users/${user.id}/credits`}
              fields={[
                { name: "quantity", label: "Qty", type: "number", defaultValue: "1" },
                { name: "reason", label: "Reason", placeholder: "Manual credit adjustment" }
              ]}
              submitLabel="Grant"
            />
          )
        }))}
      />
    </>
  );
}
