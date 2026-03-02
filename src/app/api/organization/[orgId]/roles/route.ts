import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { queryTenant, getTenantPool } from "@/lib/db/tenant-pool";
import { cache, cacheKeys } from "@/lib/cache";
import crypto from "crypto";
import { z } from "zod";
import { isValidLeadershipCombination } from "@/lib/role-mappings";

/**
 * Validation schema for creating/updating roles
 */
const createRoleSchema = z.object({
  roleName: z.string().min(1, "Role name is required"),
  leadershipLevel: z.enum(["1", "2", "3"]).transform((val) => parseInt(val)),
  systemRole: z.enum(["Admin", "Manager", "Member"]),
  focus: z.enum(["Strategy & Governance", "Tactical Deployment", "Daily Execution"]),
  description: z.string().optional(),
  accessDescription: z.string().optional(),
});

const updateRoleSchema = createRoleSchema.partial().extend({
  isActive: z.boolean().optional(),
});

/**
 * GET /api/organization/[orgId]/roles
 * Get all roles for an organization
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;

    // Get request context (user + tenant) - single call, cached
    const ctx = await getRequestContext(req, orgId);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check cache first (60s TTL)
    const cacheKey = cacheKeys.orgRoles(orgId);
    const cached = cache.get<any[]>(cacheKey);
    if (cached) {
      return NextResponse.json({ roles: cached });
    }

    try {
      const roles = await queryTenant<any>(
        orgId,
        `SELECT 
          id,
          "roleName",
          "leadershipLevel",
          "systemRole",
          focus,
          description,
          "accessDescription",
          "isPreset",
          "isActive",
          "createdAt",
          "updatedAt"
        FROM roles
        ORDER BY "leadershipLevel" ASC, "roleName" ASC`
      );

      // Cache the response for 60 seconds
      cache.set(cacheKey, roles, 60 * 1000);

      return NextResponse.json({ roles });
    } catch (dbError: any) {
      console.error("[Roles API] Database error:", dbError);
      return NextResponse.json(
        {
          error: "Failed to fetch roles",
          message: dbError.message,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error fetching roles:", error);
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/organization/[orgId]/roles
 * Create a new role (only for owners)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const body = await req.json();

    // Get request context (user + tenant) - single call, cached
    const ctx = await getRequestContext(req, orgId);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tenant } = ctx;

    // Only owners can create roles
    if (tenant.userRole !== "owner") {
      return NextResponse.json(
        { error: "Only organization owners can create roles" },
        { status: 403 }
      );
    }

    // Validate request body
    const validationResult = createRoleSchema.safeParse(body);
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

    if (!isValidLeadershipCombination(data.leadershipLevel, data.systemRole, data.focus)) {
      return NextResponse.json(
        {
          error: "Invalid role combination",
          message:
            "Leadership Level, System Role, and Focus must match: Level 1 → Admin & Strategy & Governance, Level 2 → Manager & Tactical Deployment, Level 3 → Member & Daily Execution.",
        },
        { status: 400 }
      );
    }

    try {
      const pool = await getTenantPool(orgId);
      const client = await pool.connect();

      try {
        const roleId = crypto.randomUUID();
        await client.query(
          `INSERT INTO roles (
            id, "roleName", "leadershipLevel", "systemRole", focus,
            description, "accessDescription", "isPreset", "isActive",
            "createdAt", "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
          [
            roleId,
            data.roleName,
            data.leadershipLevel,
            data.systemRole,
            data.focus,
            data.description || null,
            data.accessDescription || null,
            false, // New roles are not preset
            true, // New roles are active by default
          ]
        );

        // Clear cache after mutation
        const cacheKey = cacheKeys.orgRoles(orgId);
        cache.delete(cacheKey);

        return NextResponse.json(
          {
            message: "Role created successfully",
            role: {
              id: roleId,
              roleName: data.roleName,
              leadershipLevel: data.leadershipLevel,
              systemRole: data.systemRole,
              focus: data.focus,
              description: data.description,
              accessDescription: data.accessDescription,
              isPreset: false,
              isActive: true,
            },
          },
          { status: 201 }
        );
      } finally {
        client.release();
      }
    } catch (dbError: any) {
      return NextResponse.json(
        { error: "Failed to create role", message: dbError.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error creating role:", error);
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}
