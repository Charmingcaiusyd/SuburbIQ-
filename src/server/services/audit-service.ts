import type { UserRole } from "@/domain/enums";

export type AuditEvent = {
  actorUserId?: string;
  actorRole: UserRole;
  actionType: string;
  targetType: string;
  targetId?: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  ipAddress?: string;
};

export async function writeAuditLogStub(event: AuditEvent) {
  return {
    ...event,
    persisted: false,
    implementation: "stub"
  };
}
