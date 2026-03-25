import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { getTenantClient } from "@/lib/db/tenant-pool";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * GET /api/organization/[orgId]/dashboard-charts
 * Returns chart data for the dashboard: issues over time (created/completed) and issues by status.
 * Same data for every org member.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const ctx = await getRequestContext(req, orgId);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = await getTenantClient(orgId);

    try {
      const lineChart: { month: string; created: number; completed: number }[] = [];
      const pieChart: { status: string; count: number; fill: string }[] = [];
      const statusColors: Record<string, string> = {
        "to-do": "var(--chart-1)",
        "in-progress": "var(--chart-2)",
        done: "var(--chart-3)",
      };

      try {
        const tables = await client.query(
          `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'issues'`
        );
        if (tables.rows.length === 0) {
          return NextResponse.json({ lineChart: [], pieChart: [] });
        }

        const now = new Date();

        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
          const monthLabel = MONTHS[d.getMonth()];

          const createdRes = await client.query<{ count: string }>(
            `SELECT COUNT(*)::text as count FROM issues 
             WHERE "createdAt" >= $1 AND "createdAt" < $2`,
            [d.toISOString(), next.toISOString()]
          );
          const completedRes = await client.query<{ count: string }>(
            `SELECT COUNT(*)::text as count FROM issues 
             WHERE status = 'done' AND "updatedAt" >= $1 AND "updatedAt" < $2`,
            [d.toISOString(), next.toISOString()]
          );
          lineChart.push({
            month: monthLabel,
            created: parseInt(createdRes.rows[0]?.count ?? "0", 10),
            completed: parseInt(completedRes.rows[0]?.count ?? "0", 10),
          });
        }

        const statusRes = await client.query<{ status: string; count: string }>(
          `SELECT COALESCE(status, 'to-do') as status, COUNT(*)::text as count 
           FROM issues GROUP BY status`
        );
        const order = ["to-do", "in-progress", "done"];
        const statusRows = statusRes.rows || [];
        order.forEach((status) => {
          const row = statusRows.find((r: { status: string }) => (r.status || "to-do") === status);
          const count = row ? parseInt(row.count, 10) : 0;
          if (count > 0 || statusRows.length === 0) {
            pieChart.push({
              status: status === "to-do" ? "To Do" : status === "in-progress" ? "In Progress" : "Done",
              count,
              fill: statusColors[status] ?? "var(--chart-4)",
            });
          }
        });
        if (pieChart.length === 0) {
          pieChart.push({ status: "To Do", count: 0, fill: statusColors["to-do"] });
          pieChart.push({ status: "In Progress", count: 0, fill: statusColors["in-progress"] });
          pieChart.push({ status: "Done", count: 0, fill: statusColors.done });
        }
      } catch (e) {
        console.warn("[dashboard-charts] issues query failed:", e);
      }

      return NextResponse.json({ lineChart, pieChart });
    } catch (dbError: unknown) {
      const message = dbError instanceof Error ? dbError.message : "Unknown error";
      return NextResponse.json(
        { error: "Failed to fetch chart data", message },
        { status: 500 }
      );
    } finally {
      client.release();
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching dashboard charts:", error);
    return NextResponse.json(
      { error: "Internal server error", message },
      { status: 500 }
    );
  }
}
