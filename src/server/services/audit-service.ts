import { Prisma } from "@prisma/client";
import type { UserRole } from "@/domain/enums";
import { prisma } from "@/server/db/prisma";

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

function toJsonSafe(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function writeAuditLogStub(event: AuditEvent) {
  return writeAuditLog(event);
}

export async function writeAuditLog(event: AuditEvent) {
  const log = await prisma.auditLog.create({
    data: {
      actorUserId: event.actorUserId ?? null,
      actorRole: event.actorRole,
      actionType: event.actionType,
      targetType: event.targetType,
      targetId: event.targetId ?? null,
      beforeJson: toJsonSafe(event.before),
      afterJson: toJsonSafe(event.after),
      reason: event.reason ?? null,
      ipAddress: event.ipAddress ?? null
    }
  });

  return {
    id: log.id,
    action_type: log.actionType,
    target_type: log.targetType,
    target_id: log.targetId,
    created_at: log.createdAt.toISOString()
  };
}
