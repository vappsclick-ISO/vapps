import { Client } from "pg";
import { OnboardingData } from "@/store/onboardingStore";
import crypto from "crypto";
import { getSSLConfig } from "@/lib/db/ssl-config";

/**
 * Stores onboarding data in the tenant database
 * @param connectionString - Tenant database connection string
 * @param organizationName - Organization name
 * @param data - Complete onboarding data from all 11 steps
 */
export async function storeTenantData(
  connectionString: string,
  organizationName: string,
  data: Partial<OnboardingData>
): Promise<void> {
  const client = new Client({
    connectionString,
    ssl: getSSLConfig(connectionString),
  });

  try {
    await client.connect();

    // Start transaction
    await client.query("BEGIN");

    try {
      // 1. Store Organization Info (from step1)
      await client.query(
        `INSERT INTO "organization_info" (
          "id", "name", "registrationId", "address", "contactName", 
          "contactEmail", "phone", "website", "industry", "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
        [
          crypto.randomUUID(),
          organizationName,
          data.step1?.registrationId || null,
          data.step1?.address || null,
          data.step1?.contactName || null,
          data.step1?.contactEmail || null,
          data.step1?.phone || null,
          data.step1?.website || null,
          data.step1?.industry || null,
        ]
      );

      // 2. Store Sites and Processes (from step2)
      if (data.step2?.sites && data.step2.sites.length > 0) {
        for (let index = 0; index < data.step2.sites.length; index++) {
          const site = data.step2.sites[index];
          const siteId = crypto.randomUUID();
          
          // Auto-generate site code if not provided
          const siteCode = site.siteCode && site.siteCode.trim().length > 0 
            ? site.siteCode 
            : `S${String(index + 1).padStart(3, '0')}`;
          
          // Insert site
          await client.query(
            `INSERT INTO "sites" ("id", "name", "code", "location", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, NOW(), NOW())`,
            [siteId, site.siteName, siteCode, site.location]
          );

          // Insert processes for this site
          if (site.processes && site.processes.length > 0) {
            for (const processName of site.processes) {
              await client.query(
                `INSERT INTO "processes" ("id", "name", "siteId", "createdAt", "updatedAt")
                 VALUES ($1, $2, $3, NOW(), NOW())`,
                [crypto.randomUUID(), processName, siteId]
              );
            }
          }
        }
      }

      // 3. Store Leaders (from step3)
      if (data.step3?.leaders && data.step3.leaders.length > 0) {
        for (const leader of data.step3.leaders) {
          await client.query(
            `INSERT INTO "leaders" ("id", "name", "role", "level", "email", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
            [crypto.randomUUID(), leader.name, leader.role, leader.level, leader.email || null]
          );
        }
      }

      // 4. Store Financial Settings (from step4)
      await client.query(
        `INSERT INTO "financial_settings" (
          "id", "baseCurrency", "fiscalYearStart", "defaultTaxRate", "paymentTerms",
          "chartOfAccountsTemplate", "defaultAssetAccount", "defaultRevenueAccount",
          "defaultExpenseAccount", "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
        [
          crypto.randomUUID(),
          (data.step4?.baseCurrency as string) || null,
          (data.step4?.fiscalYearStart as string) || null,
          (data.step4?.defaultTaxRate as string) || null,
          (data.step4?.paymentTerms as string) || null,
          (data.step4?.chartOfAccountsTemplate as string) || null,
          (data.step4?.defaultAssetAccount as string) || null,
          (data.step4?.defaultRevenueAccount as string) || null,
          (data.step4?.defaultExpenseAccount as string) || null,
        ]
      );

      // 5. Store Products (from step5)
      if (data.step5?.products && data.step5.products.length > 0) {
        for (const product of data.step6.products) {
          await client.query(
            `INSERT INTO "products" (
              "id", "sku", "name", "category", "unit", "cost", "reorder", "createdAt", "updatedAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
            [
              crypto.randomUUID(),
              product.sku || null,
              product.name,
              product.category || null,
              product.unit || null,
              product.cost || null,
              product.reorder || null,
            ]
          );
        }
      }

      // 6. Store Customers and Vendors (from step6)
      const step6 = data.step6;
      if (step6?.customers && step6.customers.length > 0) {
        for (const customer of step6.customers) {
          await client.query(
            `INSERT INTO "customers" ("id", "name", "email", "phone", "address", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
            [
              crypto.randomUUID(),
              customer.name,
              customer.email || null,
              customer.phone || null,
              customer.address || null,
            ]
          );
        }
      }

      if (step6?.vendors && step6.vendors.length > 0) {
        for (const vendor of step6.vendors) {
          await client.query(
            `INSERT INTO "vendors" ("id", "name", "email", "phone", "address", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
            [
              crypto.randomUUID(),
              vendor.name,
              vendor.email || null,
              vendor.phone || null,
              vendor.address || null,
            ]
          );
        }
      }

      // 7. Store Workflow Settings (from step7)
      const step7 = data.step7;
      await client.query(
        `INSERT INTO "workflow_settings" (
          "id", "multiLevelApprovals", "automaticTaskAssignment", "criticalSLA",
          "highPrioritySLA", "mediumPrioritySLA", "lowPrioritySLA",
          "emailNotifications", "inAppNotifications", "smsNotifications",
          "escalationRules", "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
        [
          crypto.randomUUID(),
          step7?.multiLevelApprovals || false,
          step7?.automaticTaskAssignment || false,
          step7?.criticalSLA || null,
          step7?.highPrioritySLA || null,
          step7?.mediumPrioritySLA || null,
          step7?.lowPrioritySLA || null,
          step7?.emailNotifications !== false, // default true
          step7?.inAppNotifications !== false, // default true
          step7?.smsNotifications || false,
          step7?.escalationRules || null,
        ]
      );

      // 8. Store Dashboard Widgets (from step8)
      const step8 = data.step8;
      await client.query(
        `INSERT INTO "dashboard_widgets" (
          "id", "tasksCompleted", "complianceScore", "workloadByUser",
          "overdueTasks", "issueDistribution", "auditTrend",
          "projectProgress", "documentVersion", "reportFrequency", "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
        [
          crypto.randomUUID(),
          step8?.widgets?.tasksCompleted || false,
          step8?.widgets?.complianceScore || false,
          step8?.widgets?.workloadByUser || false,
          step8?.widgets?.overdueTasks || false,
          step8?.widgets?.issueDistribution || false,
          step8?.widgets?.auditTrend || false,
          step8?.widgets?.projectProgress || false,
          step8?.widgets?.documentVersion || false,
          step8?.reportFrequency || null,
        ]
      );

      // 9. Store Security Settings (from step9)
      const step9 = data.step9;
      await client.query(
        `INSERT INTO "security_settings" (
          "id", "require2FA", "ipWhitelisting", "sessionTimeout",
          "passwordPolicy", "sessionDuration", "logAllActions",
          "logRetention", "backupFrequency", "backupRetention", "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
        [
          crypto.randomUUID(),
          step9?.require2FA || false,
          step9?.ipWhitelisting || false,
          step9?.sessionTimeout || false,
          step9?.passwordPolicy || null,
          step9?.sessionDuration || null,
          step9?.logAllActions || false,
          step9?.logRetention || null,
          step9?.backupFrequency || null,
          step9?.backupRetention || null,
        ]
      );

      // 10. Seed Preset Roles
      const presetRoles = [
        // Level 1 – Admin – Strategy & Governance
        { roleName: "CEO", leadershipLevel: 1, systemRole: "Admin", focus: "Strategy & Governance", description: "Chief Executive Officer responsible for overall strategic direction, organizational vision, and executive decision-making.", accessDescription: "Full system access: Can manage all roles, users, permissions, and organizational settings." },
        { roleName: "CFO", leadershipLevel: 1, systemRole: "Admin", focus: "Strategy & Governance", description: "Chief Financial Officer overseeing financial strategy, budgeting, and fiscal governance.", accessDescription: "Full system access: Can manage all roles, users, permissions, and organizational settings." },
        { roleName: "COO", leadershipLevel: 1, systemRole: "Admin", focus: "Strategy & Governance", description: "Chief Operating Officer managing day-to-day operations and operational excellence.", accessDescription: "Full system access: Can manage all roles, users, permissions, and organizational settings." },
        { roleName: "CTO", leadershipLevel: 1, systemRole: "Admin", focus: "Strategy & Governance", description: "Chief Technology Officer leading technology strategy and digital transformation.", accessDescription: "Full system access: Can manage all roles, users, permissions, and organizational settings." },
        { roleName: "CHRO", leadershipLevel: 1, systemRole: "Admin", focus: "Strategy & Governance", description: "Chief Human Resources Officer managing talent strategy and organizational culture.", accessDescription: "Full system access: Can manage all roles, users, permissions, and organizational settings." },
        { roleName: "CMO", leadershipLevel: 1, systemRole: "Admin", focus: "Strategy & Governance", description: "Chief Marketing Officer driving brand strategy and market positioning.", accessDescription: "Full system access: Can manage all roles, users, permissions, and organizational settings." },
        // Level 2 – Manager – Tactical Deployment
        { roleName: "VP Operations", leadershipLevel: 2, systemRole: "Manager", focus: "Tactical Deployment", description: "Vice President of Operations responsible for operational strategy execution and process optimization.", accessDescription: "Manager access: Can manage level 3 roles, view reports, and manage team workflows." },
        { roleName: "Director", leadershipLevel: 2, systemRole: "Manager", focus: "Tactical Deployment", description: "Director leading departmental strategy and cross-functional initiatives.", accessDescription: "Manager access: Can manage level 3 roles, view reports, and manage team workflows." },
        { roleName: "Plant Manager", leadershipLevel: 2, systemRole: "Manager", focus: "Tactical Deployment", description: "Plant Manager overseeing manufacturing operations and production efficiency.", accessDescription: "Manager access: Can manage level 3 roles, view reports, and manage team workflows." },
        { roleName: "Quality Manager", leadershipLevel: 2, systemRole: "Manager", focus: "Tactical Deployment", description: "Quality Manager ensuring product quality standards and compliance.", accessDescription: "Manager access: Can manage level 3 roles, view reports, and manage team workflows." },
        // Level 3 – Member – Daily Execution
        { roleName: "Supervisor", leadershipLevel: 3, systemRole: "Member", focus: "Daily Execution", description: "Supervisor managing daily team activities and ensuring task completion.", accessDescription: "Member access: Can view assigned tasks, submit reports, and collaborate with team members." },
        { roleName: "Team Lead", leadershipLevel: 3, systemRole: "Member", focus: "Daily Execution", description: "Team Lead coordinating team efforts and facilitating communication.", accessDescription: "Member access: Can view assigned tasks, submit reports, and collaborate with team members." },
        { roleName: "Coordinator", leadershipLevel: 3, systemRole: "Member", focus: "Daily Execution", description: "Coordinator organizing resources and supporting operational workflows.", accessDescription: "Member access: Can view assigned tasks, submit reports, and collaborate with team members." },
      ];

      for (const role of presetRoles) {
        await client.query(
          `INSERT INTO roles (
            id, "roleName", "leadershipLevel", "systemRole", focus,
            description, "accessDescription", "isPreset", "isActive",
            "createdAt", "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
          [
            crypto.randomUUID(),
            role.roleName,
            role.leadershipLevel,
            role.systemRole,
            role.focus,
            role.description,
            role.accessDescription,
            true, // Mark as preset
            true, // Active by default
          ]
        );
      }

      // Commit transaction
      await client.query("COMMIT");
    } catch (error) {
      // Rollback on error
      await client.query("ROLLBACK");
      throw error;
    }
  } catch (error: any) {
    console.error("Error storing tenant data:", error);
    throw new Error(`Failed to store tenant data: ${error.message}`);
  } finally {
    await client.end();
  }
}
