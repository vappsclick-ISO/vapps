/**
 * Activity Logger Utility
 * 
 * Helper function to log user activities to the activity log table.
 * This should be called after successful operations to track user actions.
 */

import { getTenantClient } from "@/lib/db/tenant-pool";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function logActivity(
  orgId: string,
  processId: string,
  userId: string,
  data: {
    action: string;
    entityType: string;
    entityId?: string;
    entityTitle?: string;
    details?: Record<string, any>;
  }
): Promise<void> {
  try {
    // Get user details for caching
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      console.warn(`[ActivityLogger] User ${userId} not found, skipping log`);
      return;
    }

    // Use tenant pool instead of new Client()
    const client = await getTenantClient(orgId);

    try {
      // Verify process exists
      const processResult = await client.query(
        `SELECT id FROM processes WHERE id = $1`,
        [processId]
      );

      if (processResult.rows.length === 0) {
        client.release();
        console.warn(`[ActivityLogger] Process ${processId} not found, skipping log`);
        return;
      }

      // Insert activity log entry
      const activityId = crypto.randomUUID();
      await client.query(
        `INSERT INTO activity_log (
          id,
          "processId",
          "userId",
          "userName",
          "userEmail",
          action,
          "entityType",
          "entityId",
          "entityTitle",
          details
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          activityId,
          processId,
          user.id,
          user.name || user.email || "Unknown",
          user.email || null,
          data.action,
          data.entityType,
          data.entityId || null,
          data.entityTitle || null,
          JSON.stringify(data.details || {}),
        ]
      );

      client.release();
    } catch (dbError: any) {
      client.release();
      // Don't throw - activity logging should not break the main operation
      console.error("[ActivityLogger] Failed to log activity:", dbError.message);
    }
  } catch (error: any) {
    // Don't throw - activity logging should not break the main operation
    console.error("[ActivityLogger] Error logging activity:", error);
  }
}
