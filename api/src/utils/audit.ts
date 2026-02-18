import prisma from '../prisma';

export const logAction = async (userId: string, action: string, details?: Record<string, unknown>) => {
  try {
    const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!exists) return;
    await prisma.auditLog.create({
      data: {
        userId: exists.id,
        action,
        details: details ? JSON.stringify(details) : null
      }
    });
  } catch {
  }
};
