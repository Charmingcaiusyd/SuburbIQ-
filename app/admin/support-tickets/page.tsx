import { AdminActionForm } from "../_action-form";
import { AdminPageHeader, AdminTable, ShortId, StatusPill } from "../_components";
import { listSupportTickets } from "@/server/services/admin-service";

export default async function AdminSupportTicketsPage() {
  const tickets = await listSupportTickets();

  return (
    <>
      <AdminPageHeader
        title="Support Tickets"
        description="Triage user support tickets, send audited replies, and optionally close tickets."
      />
      <AdminTable
        columns={[
          { key: "id", label: "ID" },
          { key: "user", label: "User" },
          { key: "category", label: "Category" },
          { key: "status", label: "Status" },
          { key: "subject", label: "Subject" },
          { key: "messages", label: "Messages" },
          { key: "action", label: "Reply" }
        ]}
        rows={tickets.map((ticket) => ({
          id: <ShortId value={ticket.id} />,
          user: ticket.user_email,
          category: ticket.category,
          status: <StatusPill value={ticket.status} />,
          subject: ticket.subject,
          messages: ticket.messages_count,
          action: (
            <AdminActionForm
              endpoint={`/api/admin/support-tickets/${ticket.id}/reply`}
              fields={[
                { name: "message", label: "Message", type: "textarea", placeholder: "Support reply" },
                { name: "close", label: "Close", type: "checkbox" }
              ]}
              submitLabel="Send"
            />
          )
        }))}
      />
    </>
  );
}
