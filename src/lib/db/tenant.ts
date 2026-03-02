import { Client } from "pg";
import { prisma } from "@/lib/prisma";
import { getSSLConfig } from "@/lib/db/ssl-config";

/**
 * Get a PostgreSQL client connected to a tenant database
 * @param orgId - Organization ID
 * @returns Connected PostgreSQL client
 */
export async function getTenantClient(orgId: string): Promise<Client> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: { database: true },
  });

  if (!org || !org.database) {
    throw new Error(`Tenant database not found for organization ${orgId}`);
  }

  const client = new Client({
    connectionString: org.database.connectionString,
    ssl: getSSLConfig(org.database.connectionString),
  });

  await client.connect();
  return client;
}

