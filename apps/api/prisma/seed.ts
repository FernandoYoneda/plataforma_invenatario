import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '@prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.counter.upsert({
    where: { key: 'asset' },
    update: {},
    create: { key: 'asset', nextNumber: 1 },
  });

  const passwordHash = await bcrypt.hash('admin123', 10);

  await prisma.user.upsert({
    where: { email: 'admin@inventario.local' },
    update: {
      name: 'Administrador',
      passwordHash,
      role: Role.ADMIN,
    },
    create: {
      name: 'Administrador',
      email: 'admin@inventario.local',
      passwordHash,
      role: Role.ADMIN,
    },
  });

  console.log('Seed OK: counter asset = 1');
  console.log('Seed OK: admin@inventario.local criado/atualizado com role ADMIN');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
