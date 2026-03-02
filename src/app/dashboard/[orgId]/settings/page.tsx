import { redirect } from 'next/navigation';

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  // Await params as it's now a Promise in Next.js 15+
  const { orgId } = await params;
  // Redirect to organization profile by default
  redirect(`/dashboard/${orgId}/settings/organization-profile`);
}
