export default function TasksPage({
  params,
}: {
  params: { siteId: string; workspaceId: string };
}) {
  return (
    <div>
      <h1>Tasks</h1>
      <p>Site: {params.siteId}</p>
      <p>Workspace: {params.workspaceId}</p>
    </div>
  );
}

