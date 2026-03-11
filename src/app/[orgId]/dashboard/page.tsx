import { redirect } from "next/navigation";

export default function OrgDashboardRedirect({
  params,
}: {
  params: { orgId: string };
}) {
  const { orgId } = params;
  redirect(`/${orgId}`);
}

