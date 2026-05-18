import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '@prisma/client';

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}`);
  }

  return value;
}

const adapter = new PrismaPg({ connectionString: getRequiredEnv('DATABASE_URL') });
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminEmail = getRequiredEnv('ADMIN_EMAIL').toLowerCase();
  const adminPassword = getRequiredEnv('ADMIN_PASSWORD');
  const adminName = getRequiredEnv('ADMIN_NAME');

  await prisma.counter.upsert({
    where: { key: 'asset' },
    update: {},
    create: { key: 'asset', nextNumber: 1 },
  });

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      passwordHash,
      role: Role.ADMIN,
    },
    create: {
      name: adminName,
      email: adminEmail,
      passwordHash,
      role: Role.ADMIN,
      isActive: true,
    },
  });

  const categories = [
    'Notebook',
    'Desktop',
    'Monitor',
    'Impressora',
    'Periferico',
  ];

  for (const name of categories) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const locations = ['Estoque TI', 'Escritorio', 'Financeiro', 'RH'];

  for (const name of locations) {
    await prisma.location.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const employees = [
    {
      name: 'Ana Souza',
      email: 'ana.souza@inventario.local',
      department: 'Financeiro',
      position: 'Analista Financeira',
    },
    {
      name: 'Bruno Lima',
      email: 'bruno.lima@inventario.local',
      department: 'RH',
      position: 'Analista de RH',
    },
    {
      name: 'Carlos Mendes',
      email: 'carlos.mendes@inventario.local',
      department: 'TI',
      position: 'Tecnico de Suporte',
    },
  ];

  for (const employee of employees) {
    await prisma.employee.upsert({
      where: { email: employee.email },
      update: {
        name: employee.name,
        department: employee.department,
        position: employee.position,
      },
      create: employee,
    });
  }

  console.log('Seed OK: counter asset = 1');
  console.log(`Seed OK: ${adminEmail} criado/atualizado com role ADMIN`);
  console.log('Seed OK: categorias iniciais criadas/atualizadas');
  console.log('Seed OK: locais iniciais criados/atualizados');
  console.log('Seed OK: funcionarios iniciais criados/atualizados');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
