import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { getTenantClient } from "@/lib/db/tenant-pool";

/**
 * GET /api/organization/[orgId]/tenant-info
 * Get information about a tenant database including tables and basic stats
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const { orgId } = await params;

    // Get request context (user + tenant) - single call, cached
    const ctx = await getRequestContext(req, orgId);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tenant } = ctx;

    // Use tenant pool instead of new Client()
    const client = await getTenantClient(orgId);

    try {

      // Get database information
      const [tablesResult, dbSizeResult, connectionCountResult] = await Promise.all([
        // List all tables
        client.query(`
          SELECT 
            table_name,
            table_type
          FROM information_schema.tables 
          WHERE table_schema = 'public'
          ORDER BY table_name
        `),
        
        // Get database size
        client.query(`
          SELECT pg_size_pretty(pg_database_size($1)) as size
        `, [tenant.dbName]),
        
        // Get connection count
        client.query(`
          SELECT count(*) as connections
          FROM pg_stat_activity 
          WHERE datname = $1
        `, [tenant.dbName]),
      ]);

      // Get row counts for each table
      const tableCounts = await Promise.all(
        tablesResult.rows.map(async (table: any) => {
          try {
            const countResult = await client.query(
              `SELECT COUNT(*) as count FROM "${table.table_name}"`
            );
            return {
              ...table,
              rowCount: parseInt(countResult.rows[0].count),
            };
          } catch {
            return {
              ...table,
              rowCount: 0,
            };
          }
        })
      );

      await client.end();

      return NextResponse.json({
        organization: {
          id: org.id,
          name: org.name,
          createdAt: org.createdAt,
        },
        database: {
          name: org.database.dbName,
          host: org.database.dbHost,
          port: org.database.dbPort,
          user: org.database.dbUser,
          size: dbSizeResult.rows[0]?.size || "0 bytes",
          activeConnections: parseInt(connectionCountResult.rows[0]?.connections || "0"),
        },
        tables: tableCounts,
        connectionString: org.database.connectionString, // For reference, but be careful in production
      });
    } catch (dbError: any) {
      await client.end();
      return NextResponse.json(
        {
          error: "Failed to connect to tenant database",
          message: dbError.message,
          database: {
            name: org.database.dbName,
            host: org.database.dbHost,
            port: org.database.dbPort,
          },
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error getting tenant info:", error);
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}
