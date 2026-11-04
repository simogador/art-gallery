import { config } from "dotenv";
config({ path: ".env.local" });

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Story 2.9 : `prisma db seed` lance prisma/seed.ts, qui refuse lui-même la production
    // (garde-production). Prisma ne passe pas la commande par un shell (`&&` serait un argument) :
    // le contrôle préalable scripts/verifier-base.ts n'est lancé que par `npm run db:seed`.
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"]!,
  },
});
