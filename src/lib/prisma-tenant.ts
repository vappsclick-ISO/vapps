import { PrismaClient } from "@prisma/client";

export function getTenantPrisma(connectionString: string) {
  return new PrismaClient({
    datasources: {
      db: {
        url: connectionString,
      },
    },
  });
}
