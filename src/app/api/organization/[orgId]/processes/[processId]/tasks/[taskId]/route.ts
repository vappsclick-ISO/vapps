import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { getTenantClient } from "@/lib/db/tenant-pool";

/**
 * PUT /api/organization/[orgId]/processes/[processId]/tasks/[taskId]
 * Update an existing task (e.g., status change when moved between columns)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; processId: string; taskId: string }> }
) {
  try {
    const { orgId, processId, taskId } = await params;
    const body = await req.json();
    const {
      name,
      description,
      sprintId,
      status,
      assigneeId,
      priority,
      points,
      startDate,
      endDate,
    } = body;

    // Get request context (user + tenant) - single call, cached
    const ctx = await getRequestContext(req, orgId);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use tenant pool instead of new Client()
    const client = await getTenantClient(orgId);

    try {

      // Verify task exists and belongs to the process
      const taskResult = await client.query(
        `SELECT id, "processId" FROM tasks WHERE id = $1 AND "processId" = $2`,
        [taskId, processId]
      );

      if (taskResult.rows.length === 0) {
        client.release();
        return NextResponse.json(
          { error: "Task not found" },
          { status: 404 }
        );
      }

      // Build update query dynamically based on provided fields
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      if (name !== undefined) {
        updateFields.push(`name = $${paramIndex++}`);
        updateValues.push(name.trim());
      }
      if (description !== undefined) {
        updateFields.push(`description = $${paramIndex++}`);
        updateValues.push(description?.trim() || null);
      }
      if (sprintId !== undefined) {
        updateFields.push(`"sprintId" = $${paramIndex++}`);
        updateValues.push(sprintId || null);
      }
      if (status !== undefined) {
        updateFields.push(`status = $${paramIndex++}`);
        updateValues.push(status);
      }
      if (assigneeId !== undefined) {
        updateFields.push(`"assigneeId" = $${paramIndex++}`);
        updateValues.push(assigneeId || null);
      }
      if (priority !== undefined) {
        updateFields.push(`priority = $${paramIndex++}`);
        updateValues.push(priority);
      }
      if (points !== undefined) {
        updateFields.push(`points = $${paramIndex++}`);
        updateValues.push(points);
      }
      if (startDate !== undefined) {
        updateFields.push(`"startDate" = $${paramIndex++}`);
        updateValues.push(startDate ? new Date(startDate) : null);
      }
      if (endDate !== undefined) {
        updateFields.push(`"endDate" = $${paramIndex++}`);
        updateValues.push(endDate ? new Date(endDate) : null);
      }

      if (updateFields.length === 0) {
        client.release();
        return NextResponse.json(
          { error: "No fields to update" },
          { status: 400 }
        );
      }

      // Add updatedAt
      updateFields.push(`"updatedAt" = NOW()`);

      // Add taskId and processId for WHERE clause
      updateValues.push(taskId, processId);

      const updateQuery = `
        UPDATE tasks 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex++} AND "processId" = $${paramIndex}
      `;

      await client.query(updateQuery, updateValues);

      // Fetch the updated task
      const updatedTaskResult = await client.query(
        `SELECT * FROM tasks WHERE id = $1`,
        [taskId]
      );

      client.release();

      return NextResponse.json(
        {
          message: "Task updated successfully",
          task: updatedTaskResult.rows[0],
        },
        { status: 200 }
      );
    } catch (dbError: any) {
      client.release();
      return NextResponse.json(
        { error: "Failed to update task", message: dbError.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error updating task:", error);
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}
