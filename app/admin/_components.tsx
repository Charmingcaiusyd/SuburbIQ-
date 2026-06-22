import type { ReactNode } from "react";

type Column<T extends Record<string, ReactNode>> = {
  key: keyof T;
  label: string;
};

export function AdminPageHeader({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="admin-page-header">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function AdminTable<T extends Record<string, ReactNode>>({
  columns,
  rows,
  empty = "No records yet."
}: {
  columns: Array<Column<T>>;
  rows: T[];
  empty?: string;
}) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={String(column.key)}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>{empty}</td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={index}>
                {columns.map((column) => (
                  <td key={String(column.key)}>{row[column.key]}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  detail
}: {
  label: string;
  value: ReactNode;
  detail?: string;
}) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </article>
  );
}

export function StatusPill({ value }: { value: string | null | undefined }) {
  return <span className="status-pill">{value ?? "n/a"}</span>;
}

export function ShortId({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="muted">n/a</span>;
  return <code>{value.slice(0, 8)}</code>;
}

export function Money({ cents }: { cents: number }) {
  return <span>${(cents / 100).toFixed(2)}</span>;
}
