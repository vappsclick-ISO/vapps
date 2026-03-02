import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { prisma } from "@/lib/prisma";
import { withTenantConnection } from "@/lib/db/connection-helper";
import { roleToLeadershipTier, roleToSystemRoleDisplay } from "@/lib/roles";

/**
 * GET /api/organization/[orgId]/members
 * Returns organization members (Active) and pending invitations (Invited) for the Teams page.
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

    // Get organization to identify owner
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { ownerId: true },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Fetch members (UserOrganization + User)
    const memberships = await prisma.userOrganization.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        userId: true,
        organizationId: true,
        role: true,
        leadershipTier: true,
        jobTitle: true,
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    // Fetch pending invitations; role comes from tenant (or master if migrated).
    // Include siteId, processId, name so we can show site/process for invited members.
    const pendingInvites = await prisma.invitation.findMany({
      where: { organizationId: orgId, status: "pending" },
      select: {
        id: true,
        email: true,
        token: true,
        jobTitle: true,
        name: true,
        siteId: true,
        processId: true,
      },
    });

    const ownerIdForFilter = organization?.ownerId;
    const nonOwnerUserIds = memberships
      .filter((m) => m.user.id !== ownerIdForFilter)
      .map((m) => m.user.id);
    const allMemberUserIds = memberships.map((m) => m.user.id);

    const inviteRoles: Record<string, string> = {};
    const siteAssignments: Record<string, { siteId: string; siteName: string }[]> = {};
    const processAssignments: Record<string, { processId: string; processName: string; siteId: string; siteName: string }[]> = {};
    const siteIdMap: Record<string, string> = {};
    const processIdMap: Record<string, string> = {};
    const userAdditionalRoles: Record<string, string[]> = {};
    /** For invited members: token -> { siteId?, processId?, siteName?, processName? } */
    const inviteSiteProcess: Record<string, { siteId?: string; processId?: string; siteName?: string; processName?: string }> = {};

    // Single tenant connection: run all tenant DB queries in one round-trip
    if (ctx.tenant?.connectionString) {
      try {
        await withTenantConnection(ctx.tenant.connectionString, async (client) => {
          if (pendingInvites.length > 0) {
            const tokens = pendingInvites.map((i) => i.token);
            const roleRes = await client.query<{ token: string; role: string }>(
              `SELECT token, role FROM invitations WHERE token = ANY($1)`,
              [tokens]
            );
            roleRes.rows.forEach((row) => {
              inviteRoles[row.token] = row.role || "member";
            });
          }

          if (nonOwnerUserIds.length > 0) {
            const siteRows = await client.query<{ user_id: string; site_id: string; site_name: string }>(
              `SELECT su.user_id::text as user_id, su.site_id::text as site_id, s.name as site_name
               FROM site_users su
               INNER JOIN sites s ON s.id = su.site_id::text
               WHERE su.user_id::text = ANY($1)`,
              [nonOwnerUserIds]
            );
            siteRows.rows.forEach((row) => {
              if (!siteAssignments[row.user_id]) siteAssignments[row.user_id] = [];
              siteAssignments[row.user_id].push({ siteId: row.site_id, siteName: row.site_name });
              if (!siteIdMap[row.user_id]) siteIdMap[row.user_id] = row.site_id;
            });

            const processRows = await client.query<{
              user_id: string;
              process_id: string;
              process_name: string;
              site_id: string;
              site_name: string;
            }>(
              `SELECT pu.user_id::text as user_id, pu.process_id::text as process_id, p.name as process_name,
                      p."siteId" as site_id, s.name as site_name
               FROM process_users pu
               INNER JOIN processes p ON p.id = pu.process_id::text
               INNER JOIN sites s ON s.id = p."siteId"
               WHERE pu.user_id::text = ANY($1)`,
              [nonOwnerUserIds]
            );
            processRows.rows.forEach((row) => {
              if (!processAssignments[row.user_id]) processAssignments[row.user_id] = [];
              processAssignments[row.user_id].push({
                processId: row.process_id,
                processName: row.process_name,
                siteId: row.site_id,
                siteName: row.site_name,
              });
              if (!processIdMap[row.user_id]) processIdMap[row.user_id] = row.process_id;
              if (!siteIdMap[row.user_id]) siteIdMap[row.user_id] = row.site_id;
            });
          }

          if (allMemberUserIds.length > 0) {
            const roleRows = await client.query<{ user_id: string; name: string }>(
              `SELECT uar.user_id::text as user_id, ar.name
               FROM user_additional_roles uar
               INNER JOIN additional_roles ar ON ar.id = uar.additional_role_id AND ar.is_active = true
               WHERE uar.user_id::text = ANY($1)`,
              [allMemberUserIds]
            );
            roleRows.rows.forEach((row) => {
              if (!userAdditionalRoles[row.user_id]) userAdditionalRoles[row.user_id] = [];
              userAdditionalRoles[row.user_id].push(row.name);
            });
          }

          // Batch fetch invite site/process and resolve names (avoids N connections per invite)
          if (pendingInvites.length > 0) {
            const tokens = pendingInvites.map((i) => i.token);
            const invRes = await client.query<{ token: string; site_id: string | null; process_id: string | null }>(
              `SELECT token, site_id::text as site_id, process_id::text as process_id FROM invitations WHERE token = ANY($1)`,
              [tokens]
            );
            const siteIdsToResolve = new Set<string>();
            const processIdsToResolve = new Set<string>();
            invRes.rows.forEach((row) => {
              const sid = row.site_id ?? undefined;
              const pid = row.process_id ?? undefined;
              inviteSiteProcess[row.token] = { siteId: sid, processId: pid };
              if (sid) siteIdsToResolve.add(sid);
              if (pid) processIdsToResolve.add(pid);
            });
            const siteIdList = Array.from(siteIdsToResolve);
            const processIdList = Array.from(processIdsToResolve);
            const siteNameMap: Record<string, string> = {};
            const processNameMap: Record<string, string> = {};
            if (siteIdList.length > 0) {
              const sn = await client.query<{ id: string; name: string }>(`SELECT id::text as id, name FROM sites WHERE id::text = ANY($1)`, [siteIdList]);
              sn.rows.forEach((r) => { siteNameMap[r.id] = r.name; });
            }
            if (processIdList.length > 0) {
              const pn = await client.query<{ id: string; name: string }>(`SELECT id::text as id, name FROM processes WHERE id::text = ANY($1)`, [processIdList]);
              pn.rows.forEach((r) => { processNameMap[r.id] = r.name; });
            }
            Object.keys(inviteSiteProcess).forEach((token) => {
              const o = inviteSiteProcess[token];
              if (o?.siteId) o.siteName = siteNameMap[o.siteId];
              if (o?.processId) o.processName = processNameMap[o.processId];
            });
          }
        });
      } catch (e) {
        console.warn("Could not fetch tenant data (roles/sites/processes/invites)", e);
      }
    }

    const ownerId = organization.ownerId;

    const activeMembers = memberships.map((m) => {
      const tier = roleToLeadershipTier(m.role);
      const sites = siteAssignments[m.user.id] || [];
      const processes = processAssignments[m.user.id] || [];
      const isOwner = m.user.id === ownerId;

      return {
        id: m.user.id,
        name: (m.user.name && m.user.name.trim()) || m.user.email || "—", // Ensure name is not empty string
        email: m.user.email || "",
        leadershipTier: tier,
        systemRole: roleToSystemRoleDisplay(m.role),
        jobTitle: (m.jobTitle && m.jobTitle.trim()) || (isOwner ? "Owner" : undefined), // Ensure jobTitle is not empty string
        isOwner: isOwner,
        status: "Active" as const,
        lastActive: "—",
        avatar: m.user.image ?? undefined,
        additionalRoles: userAdditionalRoles[m.user.id] || [],
        // Site and process for every non-owner (every user has one site + one process except Owner)
        ...(sites.length > 0
          ? {
              siteName: sites.map((s) => s.siteName).join(", "),
              siteId: siteIdMap[m.user.id],
            }
          : {}),
        ...(processes.length > 0
          ? {
              processName: processes.map((p) => p.processName).join(", "),
              processId: processIdMap[m.user.id],
              ...(!siteIdMap[m.user.id] && processes[0] ? { siteName: processes[0].siteName, siteId: processes[0].siteId } : {}),
            }
          : {}),
      };
    });

    const invitedMembers = pendingInvites.map((inv) => {
      const tier = roleToLeadershipTier(inviteRoles[inv.token] || "member");
      const resolved = inviteSiteProcess[inv.token];
      const siteId = resolved?.siteId ?? inv.siteId ?? undefined;
      const processId = resolved?.processId ?? inv.processId ?? undefined;
      const siteName = resolved?.siteName;
      const processName = resolved?.processName;
      return {
        id: inv.id,
        name: (inv.name && inv.name.trim()) || inv.email || "—",
        email: inv.email,
        leadershipTier: tier,
        systemRole: roleToSystemRoleDisplay(inviteRoles[inv.token] || "member"),
        jobTitle: (inv.jobTitle && inv.jobTitle.trim()) || undefined,
        isOwner: false,
        status: "Invited" as const,
        lastActive: "Never",
        avatar: undefined,
        ...(siteId ? { siteId } : {}),
        ...(processId ? { processId } : {}),
        ...(siteName != null ? { siteName } : {}),
        ...(processName != null ? { processName } : {}),
      };
    });

    const teamMembers = [...activeMembers, ...invitedMembers];

    return NextResponse.json({ teamMembers });
  } catch (error: any) {
    console.error("Error fetching organization members:", error);
    const message = error?.message || "Unknown error";
    // Return actual error so client toast can show it (e.g. DB connection, missing table)
    return NextResponse.json(
      {
        error: message,
        code: "FETCH_MEMBERS_FAILED",
      },
      { status: 500 }
    );
  }
}
