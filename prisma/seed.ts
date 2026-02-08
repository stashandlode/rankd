import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findUnique({
    where: { username: 'admin' },
  });

  if (existing) {
    console.log('Admin user already exists, skipping seed.');
    return;
  }

  const passwordHash = await bcrypt.hash('changeme', 10);

  await prisma.user.create({
    data: {
      username: 'admin',
      passwordHash,
      role: 'admin',
    },
  });

  console.log('Created default admin user (admin / changeme)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
