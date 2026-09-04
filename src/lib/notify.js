export async function notifyUser(prisma, { ngoId, userId, title, body }) {
  if (!userId) return null;
  return prisma.notification.create({
    data: {
      ngoId: ngoId || null,
      userId,
      title,
      body: body || null,
      unread: true,
    },
  });
}
