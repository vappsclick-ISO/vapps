export default function MembersPage({
  params,
}: {
  params: { siteId: string; workspaceId: string };
}) {
  return (
    <div>
      <h1>Members</h1>
      <p>Site: {params.siteId}</p>
      <p>Workspace: {params.workspaceId}</p>
    </div>
  );
}

