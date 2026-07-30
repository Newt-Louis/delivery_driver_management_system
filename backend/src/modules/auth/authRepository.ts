import { prisma } from '../../lib/prisma';

export function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export function countActiveFaceCredentials(userId: string) {
  return prisma.faceCredential.count({
    where: { userId, isActive: true },
  });
}
