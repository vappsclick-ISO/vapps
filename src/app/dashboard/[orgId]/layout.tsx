import { notFound } from "next/navigation";
import Topbar from "@/components/dashboard/Topbar";
import Sidebar from "@/components/dashboard/Sidebar";
import { getOrgBySlugOrId } from "@/lib/org-utils";
import { OrgProvider } from "@/components/providers/org-provider";

/**
 * Dashboard layout for /dashboard/[orgSlug] (param is orgId in route segment, value is slug when using subdomain).
 * Organization validation happens here: if slug/org does not exist, return notFound().
 */
export default async function OrgDashboardLayout({
    children,
    params
}: {
    children: React.ReactNode;
    params: Promise<{ orgId: string }>;
}) {
    const { orgId: slugOrId } = await params;
    const org = await getOrgBySlugOrId(slugOrId);
    if (!org) notFound();

    return (
        <OrgProvider orgId={org.id} slug={org.slug}>
            <div className="flex min-h-screen bg-[#f9f9f9]">
                <Sidebar orgId={org.id} slug={org.slug} />
                <div className="md:w-[80%] w-full">
                    <Topbar />
                    <main className="p-6 w-full bg-[#F9F9F9] flex-1">
                        {children}
                    </main>
                </div>
            </div>
        </OrgProvider>
    );
}
