import prisma from '../prisma';

export const logAction = async (userId: string, action: string, details?: any) => {
  try {
    await (prisma as any).auditLog.create({
      data: {
        userId,
        action,
        details: details ? JSON.stringify(details) : null
      }
    });
  } catch (error) {
    console.error('[AuditLog] Failed to log action:', error);
  }
};
