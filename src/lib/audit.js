export async function writeAudit(prisma, { actor, action, target }) {
  if (!actor || !action) return null;
  return prisma.auditLog.create({
    data: {
      actor: String(actor).slice(0, 200),
      action: String(action).slice(0, 200),
      target: target ? String(target).slice(0, 200) : null,
    },
  });
}
