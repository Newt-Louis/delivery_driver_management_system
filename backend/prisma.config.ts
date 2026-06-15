import path from 'node:path'
import { defineConfig,env } from 'prisma/config'
import * as dotenv from 'dotenv'

// Load file .env tùy theo môi trường
dotenv.config({
  path: path.join(process.cwd(), `.env`),
})

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
    directUrl: env("DIRECT_URL"),
  },
})