import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { getSSLConfig } from "@/lib/db/ssl-config";

/**
 * Test endpoint to check database connection health
 * GET /api/test-db-connection
 */
export async function GET(req: NextRequest) {
  const start = Date.now();
  const connectionString = process.env.DATABASE_URL!;

  try {
    // Create a test pool connection; SSL derived from connection string (local vs AWS)
    const testPool = new Pool({
      connectionString,
      ssl: getSSLConfig(connectionString),
      max: 1,
      connectionTimeoutMillis: 10000, // 10 seconds
    });

    const client = await testPool.connect();
    
    try {
      // Run a simple query
      const queryStart = Date.now();
      const result = await client.query("SELECT 1 as test, NOW() as current_time");
      const queryTime = Date.now() - queryStart;
      const totalTime = Date.now() - start;

      await client.release();
      await testPool.end();

      return NextResponse.json({
        success: true,
        connectionTime: totalTime,
        queryTime: queryTime,
        result: result.rows[0],
        message: queryTime > 5000 
          ? `⚠️ Database is very slow (${queryTime}ms). This may cause login timeouts.`
          : `✅ Database connection is healthy (${queryTime}ms)`,
      });
    } catch (queryError: any) {
      await client.release();
      await testPool.end();
      throw queryError;
    }
  } catch (error: any) {
    const totalTime = Date.now() - start;
      return NextResponse.json(
      {
        success: false,
        connectionTime: totalTime,
        error: error.message,
        code: error.code,
        message: `❌ Database connection failed after ${totalTime}ms: ${error.message}`,
        troubleshooting: {
          note: "If you see timeouts around 20-25 seconds, check:",
          checks: [
            "AWS IAM credentials are valid and not expired",
            "AWS RDS instance is running (check AWS Console)",
            "Security groups allow connections from your IP",
            "Network connectivity to AWS RDS endpoint",
            "DATABASE_URL credentials are correct"
          ]
        }
      },
      { status: 500 }
    );
  }
}
