import Topbar from "@/components/dashboard/Topbar";
import Sidebar from "@/components/dashboard/Sidebar";

export default async function OrgDashboardLayout({
    children,
    params
}: {
    children: React.ReactNode;
    params: Promise<{ orgId: string }>;
}) {
    const { orgId } = await params;

    return (
        <div className="flex min-h-screen bg-[#f9f9f9]">

            <Sidebar orgId={orgId} />

            <div className="md:w-[80%] w-full">

                <Topbar />

                <main className="p-6 w-full bg-[#F9F9F9] flex-1">
                    {children}
                </main>
            </div>
        </div>
    );
}
