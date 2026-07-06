import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

type SeedConfig = {
  key: string;
  category: string;
  valueType?: string;
  description?: string;
  isSensitive?: boolean;
  isRuntimeEditable?: boolean;
  value: Prisma.InputJsonValue;
};

async function main() {
  const fileArg = process.argv.find((arg) => arg.startsWith('--file='));
  const filePath = fileArg
    ? path.resolve(process.cwd(), fileArg.slice('--file='.length))
    : path.resolve(__dirname, 'app-config-seed.json');

  const raw = fs.readFileSync(filePath, 'utf8');
  const configs = JSON.parse(raw) as SeedConfig[];

  for (const cfg of configs) {
    await prisma.appConfig.upsert({
      where: { key: cfg.key },
      create: {
        key: cfg.key,
        category: cfg.category,
        valueType: cfg.valueType ?? 'json',
        description: cfg.description ?? '',
        isSensitive: cfg.isSensitive ?? false,
        isRuntimeEditable: cfg.isRuntimeEditable ?? true,
        value: cfg.value,
      },
      update: {
        category: cfg.category,
        valueType: cfg.valueType ?? 'json',
        description: cfg.description ?? '',
        isSensitive: cfg.isSensitive ?? false,
        isRuntimeEditable: cfg.isRuntimeEditable ?? true,
        value: cfg.value,
      },
    });
    console.log(`✅ upsert app_config ${cfg.key}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
