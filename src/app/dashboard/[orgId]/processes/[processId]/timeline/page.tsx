'use client';

import {
  GanttFeatureItem,
  GanttFeatureList,
  GanttFeatureListGroup,
  GanttHeader,
  GanttProvider,
  GanttSidebar,
  GanttSidebarGroup,
  GanttSidebarItem,
  GanttTimeline,
  GanttToday,
  type GanttFeature,
  type GanttStatus,
} from '@/components/ui/shadcn-io/gantt';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { apiClient } from '@/lib/api-client';
import { EyeIcon, LinkIcon, TrashIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import groupBy from 'lodash.groupby';
import { addDays, endOfDay } from 'date-fns';
import { toast } from 'sonner';

const STATUS_CONFIG: Record<string, GanttStatus> = {
  'to-do': { id: 'to-do', name: 'To Do', color: '#6B7280' },
  'in-progress': { id: 'in-progress', name: 'In Progress', color: '#F59E0B' },
  'in-review': { id: 'in-review', name: 'In Review', color: '#8B5CF6' },
  done: { id: 'done', name: 'Done', color: '#10B981' },
};

type Issue = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  deadline?: string | null;
};

function issueToFeature(issue: Issue): GanttFeature {
  const startAt = new Date(issue.createdAt);
  let endAt: Date;
  if (issue.deadline) {
    const d = new Date(issue.deadline);
    endAt = endOfDay(d);
  } else {
    endAt = addDays(startAt, 1);
  }
  const status = STATUS_CONFIG[issue.status] ?? STATUS_CONFIG['to-do'];
  return {
    id: issue.id,
    name: issue.title || 'Untitled',
    startAt,
    endAt,
    status,
  };
}

export default function TimelinePage() {
  const params = useParams();
  const orgId = params?.orgId as string;
  const processId = params?.processId as string;

  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIssues = useCallback(async () => {
    if (!orgId || !processId) return;
    try {
      setLoading(true);
      const res = await apiClient.getIssues(orgId, processId);
      setIssues(res.issues ?? []);
    } catch (err: any) {
      console.error('Failed to fetch issues:', err);
      toast.error(err?.message ?? 'Failed to load issues');
      setIssues([]);
    } finally {
      setLoading(false);
    }
  }, [orgId, processId]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  useEffect(() => {
    const onCreated = (e: Event) => {
      const ev = e as CustomEvent;
      if (ev.detail?.orgId === orgId && ev.detail?.processId === processId) fetchIssues();
    };
    const onUpdated = (e: Event) => {
      const ev = e as CustomEvent;
      if (ev.detail?.orgId === orgId && ev.detail?.processId === processId) fetchIssues();
    };
    window.addEventListener('issueCreated', onCreated);
    window.addEventListener('issueUpdated', onUpdated);
    return () => {
      window.removeEventListener('issueCreated', onCreated);
      window.removeEventListener('issueUpdated', onUpdated);
    };
  }, [orgId, processId, fetchIssues]);

  const features = useMemo(() => issues.map(issueToFeature), [issues]);
  const groupedByStatus = useMemo(() => {
    const g = groupBy(features, (f) => f.status.name);
    return Object.fromEntries(
      Object.entries(g).sort(([a], [b]) => a.localeCompare(b))
    );
  }, [features]);

  const openIssueDialog = useCallback(
    (issueId: string) => {
      window.dispatchEvent(
        new CustomEvent('openIssueDialog', {
          detail: { issueId, orgId, processId },
        })
      );
    },
    [orgId, processId]
  );

  const handleCopyLink = useCallback(
    (issueId: string) => {
      const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/dashboard/${orgId}/processes/${processId}?issueId=${issueId}`;
      navigator.clipboard.writeText(url).then(
        () => toast.success('Link copied'),
        () => toast.error('Failed to copy')
      );
    },
    [orgId, processId]
  );

  const handleRemove = useCallback(
    async (issueId: string) => {
      if (!orgId || !processId) return;
      try {
        await apiClient.deleteIssue(orgId, processId, issueId);
        toast.success('Issue removed');
        fetchIssues();
      } catch (err: any) {
        toast.error(err?.message ?? 'Failed to remove issue');
      }
    },
    [orgId, processId, fetchIssues]
  );

  const handleAddItem = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent('openIssueDialog', {
        detail: { orgId, processId },
      })
    );
  }, [orgId, processId]);

  if (!orgId || !processId) {
    return (
      <div className="flex h-[400px] items-center justify-center text-muted-foreground">
        Invalid context
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center text-muted-foreground">
        Loading timeline...
      </div>
    );
  }

  if (features.length === 0) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center gap-2 text-muted-foreground">
        <p>No issues to show on the timeline.</p>
        <p className="text-sm">Create an issue to see it from created date to deadline.</p>
      </div>
    );
  }

  return (
    <div className="h-[600px] w-full">
      <GanttProvider
        className="border"
        onAddItem={handleAddItem}
        range="monthly"
        zoom={100}
      >
        <GanttSidebar>
          {Object.entries(groupedByStatus).map(([groupName, groupFeatures]) => (
            <GanttSidebarGroup key={groupName} name={groupName}>
              {groupFeatures.map((feature) => (
                <GanttSidebarItem
                  key={feature.id}
                  feature={feature}
                  onSelectItem={() => openIssueDialog(feature.id)}
                />
              ))}
            </GanttSidebarGroup>
          ))}
        </GanttSidebar>
        <GanttTimeline>
          <GanttHeader />
          <GanttFeatureList>
            {Object.entries(groupedByStatus).map(([groupName, groupFeatures]) => (
              <GanttFeatureListGroup key={groupName}>
                {groupFeatures.map((feature) => (
                  <div className="flex" key={feature.id}>
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <button
                          type="button"
                          onClick={() => openIssueDialog(feature.id)}
                          className="w-full text-left"
                        >
                          <GanttFeatureItem {...feature}>
                            <p className="flex-1 truncate text-xs">{feature.name}</p>
                          </GanttFeatureItem>
                        </button>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem
                          className="flex items-center gap-2"
                          onClick={() => openIssueDialog(feature.id)}
                        >
                          <EyeIcon className="text-muted-foreground" size={16} />
                          View issue
                        </ContextMenuItem>
                        <ContextMenuItem
                          className="flex items-center gap-2"
                          onClick={() => handleCopyLink(feature.id)}
                        >
                          <LinkIcon className="text-muted-foreground" size={16} />
                          Copy link
                        </ContextMenuItem>
                        <ContextMenuItem
                          className="flex items-center gap-2 text-destructive"
                          onClick={() => handleRemove(feature.id)}
                        >
                          <TrashIcon size={16} />
                          Remove from timeline
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  </div>
                ))}
              </GanttFeatureListGroup>
            ))}
          </GanttFeatureList>
          <GanttToday />
        </GanttTimeline>
      </GanttProvider>
    </div>
  );
}
