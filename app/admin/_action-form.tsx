"use client";

import { useState } from "react";

type Field = {
  name: string;
  label: string;
  type?: "text" | "number" | "textarea" | "checkbox" | "json";
  placeholder?: string;
  defaultValue?: string;
  defaultChecked?: boolean;
};

export function AdminActionForm({
  endpoint,
  method = "POST",
  fields,
  submitLabel
}: {
  endpoint: string;
  method?: "POST" | "PUT";
  fields: Field[];
  submitLabel: string;
}) {
  const [status, setStatus] = useState<string | null>(null);

  return (
    <form
      className="admin-action-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setStatus("Working...");
        const data = new FormData(event.currentTarget);
        const payload: Record<string, unknown> = {};

        try {
          for (const field of fields) {
            if (field.type === "checkbox") {
              payload[field.name] = data.get(field.name) === "on";
              continue;
            }

            const raw = String(data.get(field.name) ?? "");
            if (field.type === "number") {
              payload[field.name] = Number(raw);
            } else if (field.type === "json") {
              if (raw.trim()) {
                payload[field.name] = JSON.parse(raw);
              }
            } else {
              payload[field.name] = raw;
            }
          }
        } catch {
          setStatus("Invalid JSON");
          return;
        }
        }

        const response = await fetch(endpoint, {
          method,
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload)
        });
        setStatus(response.ok ? "Done" : `Failed (${response.status})`);
      }}
    >
      {fields.map((field) => (
        <label key={field.name}>
          <span>{field.label}</span>
          {field.type === "textarea" || field.type === "json" ? (
            <textarea
              name={field.name}
              placeholder={field.placeholder}
              defaultValue={field.defaultValue}
              rows={field.type === "json" ? 4 : 2}
            />
          ) : (
            <input
              name={field.name}
              type={field.type === "checkbox" ? "checkbox" : field.type ?? "text"}
              placeholder={field.placeholder}
              defaultValue={field.defaultValue}
              defaultChecked={field.defaultChecked}
            />
          )}
        </label>
      ))}
      <button type="submit">{submitLabel}</button>
      {status ? <small>{status}</small> : null}
    </form>
  );
}
