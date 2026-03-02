import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { queryTenant, getTenantClient } from "@/lib/db/tenant-pool";
import crypto from "crypto";

/**
 * GET /api/organization/[orgId]/metadata?type=titles|tags|sources
 * Get metadata (titles, tags, or sources) for an organization
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // titles, tags, or sources

    // Get request context (user + tenant) - single call, cached
    const ctx = await getRequestContext(req, orgId);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!type || !["titles", "tags", "sources"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid type. Must be 'titles', 'tags', or 'sources'" },
        { status: 400 }
      );
    }

    try {
      const tableName = `issue_${type}`;
      const result = await queryTenant(
        orgId,
        `SELECT id, name, "createdAt" FROM ${tableName} ORDER BY name ASC`
      );

      return NextResponse.json({
        [type]: result.map((row: any) => row.name),
      });
    } catch (dbError: any) {
      return NextResponse.json(
        { error: `Failed to fetch ${type}`, message: dbError.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error(`Error fetching ${type}:`, error);
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/organization/[orgId]/metadata?type=titles|tags|sources
 * Add a new metadata value (title, tag, or source)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const body = await req.json();
    const { name } = body;

    // Get request context (user + tenant) - single call, cached
    const ctx = await getRequestContext(req, orgId);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!type || !["titles", "tags", "sources"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid type. Must be 'titles', 'tags', or 'sources'" },
        { status: 400 }
      );
    }

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Use tenant pool instead of new Client()
    const client = await getTenantClient(orgId);

    try {
      const tableName = `issue_${type}`;
      const trimmedName = name.trim();

      // Check if already exists
      const existing = await client.query(
        `SELECT id FROM ${tableName} WHERE name = $1`,
        [trimmedName]
      );

      if (existing.rows.length > 0) {
        client.release();
        return NextResponse.json(
          {
            message: `${type.slice(0, -1)} already exists`,
            name: trimmedName,
          },
          { status: 200 }
        );
      }

      // Insert new metadata
      const id = crypto.randomUUID();
      await client.query(
        `INSERT INTO ${tableName} (id, name, "createdAt")
         VALUES ($1, $2, NOW())`,
        [id, trimmedName]
      );

      client.release();

      return NextResponse.json(
        {
          message: `${type.slice(0, -1)} added successfully`,
          name: trimmedName,
        },
        { status: 201 }
      );
    } catch (dbError: any) {
      client.release();
      return NextResponse.json(
        { error: `Failed to add ${type}`, message: dbError.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error(`Error adding ${type}:`, error);
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}
