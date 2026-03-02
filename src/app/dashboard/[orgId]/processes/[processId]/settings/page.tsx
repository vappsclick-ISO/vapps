export default function WorkspaceSettingsPage({
  params,
}: {
  params: { siteId: string; workspaceId: string };
}) {
  return (
    <div>
      <h1>Workspace Settings</h1>
      <p>Site: {params.siteId}</p>
      <p>Workspace: {params.workspaceId}</p>
    </div>
  );
}

