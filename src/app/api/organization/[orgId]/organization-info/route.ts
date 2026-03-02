import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { getTenantClient } from "@/lib/db/tenant-pool";
import crypto from "crypto";

/**
 * GET /api/organization/[orgId]/organization-info
 * Get organization info from tenant database
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

    // Use tenant pool instead of new Client()
    const client = await getTenantClient(orgId);

    try {
      // Get organization info
      const result = await client.query(
        `SELECT * FROM organization_info ORDER BY "createdAt" DESC LIMIT 1`
      );

      client.release();

      if (result.rows.length === 0) {
        return NextResponse.json({
          organizationInfo: null,
        });
      }

      return NextResponse.json({
        organizationInfo: result.rows[0],
      });
    } catch (dbError: any) {
      client.release();
      return NextResponse.json(
        { error: "Failed to fetch organization info", message: dbError.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error fetching organization info:", error);
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/organization/[orgId]/organization-info
 * Update organization info in tenant database
 */
export async function PUT(
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

    // Use tenant pool instead of new Client()
    const client = await getTenantClient(orgId);

    try {
      // Check if organization info exists
      const existingResult = await client.query(
        `SELECT id FROM organization_info ORDER BY "createdAt" DESC LIMIT 1`
      );

      const {
        name,
        registrationId,
        address,
        contactName,
        contactEmail,
        phone,
        website,
        industry,
      } = body;

      if (existingResult.rows.length === 0) {
        // Create new organization info
        const id = crypto.randomUUID();
        await client.query(
          `INSERT INTO organization_info (
            id, name, "registrationId", address, "contactName", 
            "contactEmail", phone, website, industry, "createdAt", "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
          [id, name, registrationId || null, address || null, contactName || null, contactEmail || null, phone || null, website || null, industry || null]
        );
      } else {
        // Update existing organization info
        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (name !== undefined) {
          updates.push(`name = $${paramIndex++}`);
          values.push(name);
        }
        if (registrationId !== undefined) {
          updates.push(`"registrationId" = $${paramIndex++}`);
          values.push(registrationId || null);
        }
        if (address !== undefined) {
          updates.push(`address = $${paramIndex++}`);
          values.push(address || null);
        }
        if (contactName !== undefined) {
          updates.push(`"contactName" = $${paramIndex++}`);
          values.push(contactName || null);
        }
        if (contactEmail !== undefined) {
          updates.push(`"contactEmail" = $${paramIndex++}`);
          values.push(contactEmail || null);
        }
        if (phone !== undefined) {
          updates.push(`phone = $${paramIndex++}`);
          values.push(phone || null);
        }
        if (website !== undefined) {
          updates.push(`website = $${paramIndex++}`);
          values.push(website || null);
        }
        if (industry !== undefined) {
          updates.push(`industry = $${paramIndex++}`);
          values.push(industry || null);
        }

        if (updates.length > 0) {
          updates.push(`"updatedAt" = NOW()`);
          values.push(existingResult.rows[0].id);

          await client.query(
            `UPDATE organization_info SET ${updates.join(", ")} WHERE id = $${paramIndex}`,
            values
          );
        }
      }

      // Fetch updated organization info
      const updatedResult = await client.query(
        `SELECT * FROM organization_info ORDER BY "createdAt" DESC LIMIT 1`
      );

      client.release();

      return NextResponse.json({
        message: "Organization info updated successfully",
        organizationInfo: updatedResult.rows[0],
      });
    } catch (dbError: any) {
      client.release();
      return NextResponse.json(
        { error: "Failed to update organization info", message: dbError.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error updating organization info:", error);
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}
