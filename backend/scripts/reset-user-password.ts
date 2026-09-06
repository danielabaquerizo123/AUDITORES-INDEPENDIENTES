import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

const required = ['RESET_EMAIL', 'RESET_PASSWORD', 'RESET_ORGANIZATION_ID'] as const;

export async function resetUserPassword(prisma: PrismaClient, input: Record<string, string | undefined>) {
  for (const key of required) {
    if (!input[key]) {
      throw new Error(`${key} is required`);
    }
  }

  const organizationId = input.RESET_ORGANIZATION_ID!;
  const email = input.RESET_EMAIL!.toLowerCase();

  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) {
    throw new Error('Organization not found');
  }

  const user = await prisma.user.findUnique({ where: { organizationId_email: { organizationId, email } } });
  if (!user) {
    throw new Error('User not found');
  }

  const passwordHash = await argon2.hash(input.RESET_PASSWORD!, { type: argon2.argon2id });

  return prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });
}

async function main() {
  const prisma = new PrismaClient();
  try {
    await resetUserPassword(prisma, process.env);
    console.log('Password reset successfully');
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) void main();
