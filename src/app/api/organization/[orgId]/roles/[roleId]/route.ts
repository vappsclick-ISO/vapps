import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { getTenantPool } from "@/lib/db/tenant-pool";
import { cache, cacheKeys } from "@/lib/cache";
import { z } from "zod";
import { isValidLeadershipCombination } from "@/lib/role-mappings";

const updateRoleSchema = z.object({
  roleName: z.string().min(1).optional(),
  leadershipLevel: z.enum(["1", "2", "3"]).transform((val) => parseInt(val)).optional(),
  systemRole: z.enum(["Admin", "Manager", "Member"]).optional(),
  focus: z.enum(["Strategy & Governance", "Tactical Deployment", "Daily Execution"]).optional(),
  description: z.string().optional(),
  accessDescription: z.string().optional(),
  isActive: z.boolean().optional(),
});

/**
 * PUT /api/organization/[orgId]/roles/[roleId]
 * Update a role
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; roleId: string }> }
) {
  try {
    const { orgId, roleId } = await params;
    const body = await req.json();

    // Get request context (user + tenant) - single call, cached
    const ctx = await getRequestContext(req, orgId);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tenant } = ctx;

    // Only owners can update roles
    if (tenant.userRole !== "owner") {
      return NextResponse.json(
        { error: "Only organization owners can update roles" },
        { status: 403 }
      );
    }

    // Validate request body
    const validationResult = updateRoleSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid role data",
          details: validationResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    try {
      const pool = await getTenantPool(orgId);
      const client = await pool.connect();

      try {
        // Check if role exists and get current level/role/focus for validation
        const existingRole = await client.query(
          `SELECT id, "isPreset", "leadershipLevel", "systemRole", focus FROM roles WHERE id = $1`,
          [roleId]
        );

        if (existingRole.rows.length === 0) {
          return NextResponse.json(
            { error: "Role not found" },
            { status: 404 }
          );
        }

        const existing = existingRole.rows[0];
        const effectiveLevel = data.leadershipLevel ?? existing.leadershipLevel;
        const effectiveSystemRole = data.systemRole ?? existing.systemRole;
        const effectiveFocus = data.focus ?? existing.focus;

        if (
          (data.leadershipLevel !== undefined ||
            data.systemRole !== undefined ||
            data.focus !== undefined) &&
          !isValidLeadershipCombination(
            effectiveLevel,
            effectiveSystemRole,
            effectiveFocus
          )
        ) {
          return NextResponse.json(
            {
              error: "Invalid role combination",
              message:
                "Leadership Level, System Role, and Focus must match: Level 1 → Admin & Strategy & Governance, Level 2 → Manager & Tactical Deployment, Level 3 → Member & Daily Execution.",
            },
            { status: 400 }
          );
        }

        // Build update query dynamically
        const updateFields: string[] = [];
        const updateValues: any[] = [];
        let paramIndex = 1;

        if (data.roleName !== undefined) {
          updateFields.push(`"roleName" = $${paramIndex++}`);
          updateValues.push(data.roleName);
        }
        if (data.leadershipLevel !== undefined) {
          updateFields.push(`"leadershipLevel" = $${paramIndex++}`);
          updateValues.push(data.leadershipLevel);
        }
        if (data.systemRole !== undefined) {
          updateFields.push(`"systemRole" = $${paramIndex++}`);
          updateValues.push(data.systemRole);
        }
        if (data.focus !== undefined) {
          updateFields.push(`focus = $${paramIndex++}`);
          updateValues.push(data.focus);
        }
        if (data.description !== undefined) {
          updateFields.push(`description = $${paramIndex++}`);
          updateValues.push(data.description);
        }
        if (data.accessDescription !== undefined) {
          updateFields.push(`"accessDescription" = $${paramIndex++}`);
          updateValues.push(data.accessDescription);
        }
        if (data.isActive !== undefined) {
          updateFields.push(`"isActive" = $${paramIndex++}`);
          updateValues.push(data.isActive);
        }

        if (updateFields.length === 0) {
          return NextResponse.json(
            { error: "No fields to update" },
            { status: 400 }
          );
        }

        // Always update updatedAt
        updateFields.push(`"updatedAt" = NOW()`);
        updateValues.push(roleId);

        await client.query(
          `UPDATE roles SET ${updateFields.join(", ")} WHERE id = $${paramIndex}`,
          updateValues
        );

        // Fetch updated role
        const updatedRole = await client.query(
          `SELECT * FROM roles WHERE id = $1`,
          [roleId]
        );

        // Clear cache after mutation
        const cacheKey = cacheKeys.orgRoles(orgId);
        cache.delete(cacheKey);

        return NextResponse.json({
          message: "Role updated successfully",
          role: updatedRole.rows[0],
        });
      } finally {
        client.release();
      }
    } catch (dbError: any) {
      return NextResponse.json(
        { error: "Failed to update role", message: dbError.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error updating role:", error);
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/organization/[orgId]/roles/[roleId]
 * Delete a role (only non-preset roles can be deleted)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; roleId: string }> }
) {
  try {
    const { orgId, roleId } = await params;

    // Get request context (user + tenant) - single call, cached
    const ctx = await getRequestContext(req, orgId);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tenant } = ctx;

    // Only owners can delete roles
    if (tenant.userRole !== "owner") {
      return NextResponse.json(
        { error: "Only organization owners can delete roles" },
        { status: 403 }
      );
    }

    try {
      const pool = await getTenantPool(orgId);
      const client = await pool.connect();

      try {
        // Check if role exists and is preset
        const existingRole = await client.query(
          `SELECT id, "isPreset" FROM roles WHERE id = $1`,
          [roleId]
        );

        if (existingRole.rows.length === 0) {
          return NextResponse.json(
            { error: "Role not found" },
            { status: 404 }
          );
        }

        if (existingRole.rows[0].isPreset) {
          return NextResponse.json(
            { error: "Preset roles cannot be deleted" },
            { status: 403 }
          );
        }

        await client.query(`DELETE FROM roles WHERE id = $1`, [roleId]);

        // Clear cache after mutation
        const cacheKey = cacheKeys.orgRoles(orgId);
        cache.delete(cacheKey);

        return NextResponse.json({
          message: "Role deleted successfully",
        });
      } finally {
        client.release();
      }
    } catch (dbError: any) {
      return NextResponse.json(
        { error: "Failed to delete role", message: dbError.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error deleting role:", error);
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}
