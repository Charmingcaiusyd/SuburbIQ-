import Link from "next/link";
import { requireAdminPageUser } from "@/server/auth/page-user";

export const dynamic = "force-dynamic";

const navItems = [
  ["Dashboard", "/admin"],
  ["Users", "/admin/users"],
  ["Orders", "/admin/orders"],
  ["Credits", "/admin/credits"],
  ["Subscriptions", "/admin/subscriptions"],
  ["Report Jobs", "/admin/report-jobs"],
  ["Reports", "/admin/reports"],
  ["Support", "/admin/support-tickets"],
  ["Coupons", "/admin/coupons"],
  ["Data Releases", "/admin/data-releases"],
  ["Templates", "/admin/templates"],
  ["Settings", "/admin/settings"],
  ["Audit Logs", "/admin/audit-logs"]
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminPageUser();

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div>
          <strong>SuburbIQ Admin</strong>
          <span>{user.email}</span>
        </div>
        <nav>
          {navItems.map(([label, href]) => (
            <Link href={href} key={href}>
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="admin-content">{children}</main>
    </div>
  );
}
