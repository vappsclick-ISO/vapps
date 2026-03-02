"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Info,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";

type Issue = {
  id: string;
  priority: "low" | "medium" | "high" | "critical";
  tags: string[];
  title: string;
  status: string;
  points: number;
  assignee: string;
  order?: number;
  sprintId?: string | null;
};

type Sprint = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isOpen: boolean;
  isRenaming: boolean;
  issues: Issue[];
};

export default function SprintAndBacklogList() {
  const params = useParams();
  const orgId = params.orgId as string;
  const processId = params.processId as string;

  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [backlogIssues, setBacklogIssues] = useState<Issue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [issueToDelete, setIssueToDelete] = useState<Issue | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sprintDetail, setSprintDetail] = useState<Sprint | null>(null);

  // ---------------------- FETCH DATA FROM API -------------------------
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Fetch sprints with their issues
      const sprintsResponse = await apiClient.getSprints(orgId, processId);
      const sprintsData = sprintsResponse.sprints.map((sprint: any) => ({
        ...sprint,
      isOpen: true,
      isRenaming: false,
        issues: sprint.issues || [],
      }));
      setSprints(sprintsData);

      // Fetch backlog issues (sprintId is null)
      // Filter out issues with status "in-progress" - they should not appear in backlog
      const backlogResponse = await apiClient.getIssues(orgId, processId, null);
      const allBacklogIssues = backlogResponse.issues || [];
      // Only show issues that are not "in-progress" and have no sprint assigned
      const filteredBacklog = allBacklogIssues.filter(
        (issue: Issue) => issue.status !== "in-progress" && !issue.sprintId
      );
      setBacklogIssues(filteredBacklog);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load sprints and issues");
    } finally {
      setIsLoading(false);
    }
  }, [orgId, processId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Listen for issue creation and status update events to refresh
  useEffect(() => {
    const handleIssueCreated = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail.processId === processId && customEvent.detail.orgId === orgId) {
        fetchData();
      }
    };

    const handleIssueUpdated = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail.processId === processId && customEvent.detail.orgId === orgId) {
        // If issue status changed to "in-progress", refresh to remove it from backlog
        if (customEvent.detail.status === "in-progress") {
          fetchData();
        }
      }
    };

    window.addEventListener('issueCreated', handleIssueCreated);
    window.addEventListener('issueUpdated', handleIssueUpdated);
    return () => {
      window.removeEventListener('issueCreated', handleIssueCreated);
      window.removeEventListener('issueUpdated', handleIssueUpdated);
    };
  }, [orgId, processId, fetchData]);

  // ---------------------- DATE UTILITIES -------------------------
  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatDateForAPI = (date: Date) => {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  };

  const addDays = (date: Date, days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  };

  const createSprintDates = () => {
    if (sprints.length === 0) {
      const start = new Date();
      const end = addDays(start, 14);
      return { 
        start: formatDateForAPI(start), 
        end: formatDateForAPI(end),
        startFormatted: formatDate(start),
        endFormatted: formatDate(end)
      };
    }

    const lastSprint = sprints[sprints.length - 1];
    const lastEnd = new Date(lastSprint.endDate);

    const start = addDays(lastEnd, 1);
    const end = addDays(start, 14);

    return { 
      start: formatDateForAPI(start), 
      end: formatDateForAPI(end),
      startFormatted: formatDate(start),
      endFormatted: formatDate(end)
    };
  };

  // ---------------------- CREATE SPRINT --------------------------
  const addSprint = async () => {
    try {
      const { start, end, startFormatted, endFormatted } = createSprintDates();
      const sprintNumber = sprints.length + 1;

      const result = await apiClient.createSprint(orgId, processId, {
        name: `Sprint ${sprintNumber}`,
        startDate: start,
        endDate: end,
      });

    const newSprint: Sprint = {
        ...result.sprint,
      isOpen: true,
      isRenaming: false,
      issues: [],
    };

    setSprints([...sprints, newSprint]);
      toast.success("Sprint created successfully");
    } catch (error: any) {
      console.error("Error creating sprint:", error);
      toast.error(error.message || "Failed to create sprint");
    }
  };

  // ---------------------- DELETE SPRINT --------------------------
  const deleteSprint = async (id: string) => {
    try {
      await apiClient.deleteSprint(orgId, processId, id);
    setSprints((prev) => prev.filter((s) => s.id !== id));
      toast.success("Sprint deleted successfully");
    } catch (error: any) {
      console.error("Error deleting sprint:", error);
      toast.error(error.message || "Failed to delete sprint");
    }
  };

  // ---------------------- RENAME SPRINT --------------------------
  const startRenaming = (id: string) => {
    setSprints((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, isRenaming: true } : s
      )
    );
  };

  const finishRenaming = async (id: string, newName: string) => {
    if (!newName || !newName.trim()) {
      setSprints((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, isRenaming: false } : s
        )
      );
      return;
    }

    try {
      await apiClient.updateSprint(orgId, processId, id, {
        name: newName.trim(),
      });

      setSprints((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, name: newName.trim(), isRenaming: false } : s
        )
      );
      toast.success("Sprint renamed successfully");
    } catch (error: any) {
      console.error("Error renaming sprint:", error);
      toast.error(error.message || "Failed to rename sprint");
    setSprints((prev) =>
      prev.map((s) =>
          s.id === id ? { ...s, isRenaming: false } : s
      )
    );
    }
  };

  // ---------------------- DRAG AND DROP -------------------------------
  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const sourceId = result.source.droppableId;
    const destId = result.destination.droppableId;
    const issueId = result.draggableId;

    // If dropped in the same position, do nothing
    if (sourceId === destId && result.source.index === result.destination.index) {
      return;
    }

    const getList = (id: string) => {
      if (id === "backlog") return backlogIssues;
      const sprint = sprints.find((s) => s.id === id);
      return sprint ? sprint.issues : [];
    };

    const sourceList = getList(sourceId);
    const destList = getList(destId);
    const movedIssue = sourceList.find((i) => i.id === issueId);

    if (!movedIssue) return;

    // Check if moving within the same list (reordering) or between different lists
    if (sourceId === destId) {
      // Same list: just reorder
      const newList = [...sourceList];
      const [removed] = newList.splice(result.source.index, 1);
      newList.splice(result.destination.index, 0, removed);

      // Update the single list
      if (sourceId === "backlog") {
        setBacklogIssues(newList);
      } else {
        setSprints((prev) =>
          prev.map((s) => (s.id === sourceId ? { ...s, issues: newList } : s))
        );
      }
    } else {
      // Different lists: move between lists
      const newSourceList = sourceList.filter((i) => i.id !== issueId);
      const newDestList = [...destList];
      newDestList.splice(result.destination.index, 0, movedIssue);

      // Update source list
      if (sourceId === "backlog") {
        setBacklogIssues(newSourceList);
      } else {
        setSprints((prev) =>
          prev.map((s) => (s.id === sourceId ? { ...s, issues: newSourceList } : s))
        );
      }

      // Update destination list
      if (destId === "backlog") {
        setBacklogIssues(newDestList);
      } else {
        setSprints((prev) =>
          prev.map((s) => (s.id === destId ? { ...s, issues: newDestList } : s))
        );
      }
    }

    // Update in database
    try {
      await apiClient.updateIssue(orgId, processId, issueId, {
        sprintId: destId === "backlog" ? null : destId,
        order: result.destination.index,
      });
    } catch (error: any) {
      console.error("Error updating issue:", error);
      toast.error("Failed to move issue");
      // Revert on error
      fetchData();
    }
  };

  const handleConfirmDelete = async () => {
    if (!issueToDelete) return;
    try {
      setIsDeleting(true);
      await apiClient.deleteIssue(orgId, processId, issueToDelete.id);
      setIssueToDelete(null);
      toast.success("Issue deleted");
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete issue");
    } finally {
      setIsDeleting(false);
    }
  };

  const openUpdateForm = (issueId: string) => {
    window.dispatchEvent(
      new CustomEvent("openIssueDialog", {
        detail: { issueId, orgId, processId },
      })
    );
  };

  const renderIssueCard = (issue: Issue, index: number) => (
    <Draggable draggableId={issue.id} index={index} key={issue.id}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          style={{
            ...provided.draggableProps.style,
            zIndex: snapshot.isDragging ? 50 : "auto",
          }}
          className="flex items-center justify-between p-4 border-b bg-white"
        >
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div {...provided.dragHandleProps} className="cursor-grab text-gray-400 shrink-0">
              <GripVertical />
            </div>

            <button
              type="button"
              onClick={() => openUpdateForm(issue.id)}
              className="text-left flex-1 min-w-0 rounded-md hover:bg-muted/50 transition-colors -m-2 p-2 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-muted-foreground">{issue.id}</span>
                <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full">
                  {issue.priority}
                </span>
              </div>
              <p className="text-sm mt-1 font-medium">{issue.title}</p>
            </button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openUpdateForm(issue.id)}>
                <Pencil className="mr-2 h-4 w-4" />
                Update
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setIssueToDelete(issue)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </Draggable>
  );
  
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="space-y-6 mt-6">

        {sprints.map((sprint) => (
          <div
            key={sprint.id}
            className="rounded-xl border bg-white"
          >
            <div className="flex items-center justify-between p-4">

              {/* Toggle & Title */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setSprints((prev) =>
                      prev.map((s) =>
                        s.id === sprint.id ? { ...s, isOpen: !s.isOpen } : s
                      )
                    )
                  }
                  className="p-0.5 rounded hover:bg-muted"
                  aria-label={sprint.isOpen ? "Collapse" : "Expand"}
                >
                  {sprint.isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </button>

                {/* Sprint name: click to open full detail; double-click to rename */}
                {sprint.isRenaming ? (
                  <input
                    autoFocus
                    defaultValue={sprint.name}
                    onBlur={(e) => finishRenaming(sprint.id, e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      finishRenaming(sprint.id, (e.target as HTMLInputElement).value)
                    }
                    className="border px-2 py-1 rounded"
                  />
                ) : (
                  <h2
                    className="text-lg font-medium cursor-pointer hover:underline"
                    onClick={() => setSprintDetail(sprint)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      startRenaming(sprint.id);
                    }}
                  >
                    {sprint.name}
                  </h2>
                )}
              </div>

              {/* Right side controls */}
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSprintDetail(sprint);
                  }}
                >
                  <Info className="h-4 w-4 mr-1" />
                  View details
                </Button>
                <Badge variant="secondary">
                  {sprint.issues.length} issues
                </Badge>
                <Badge variant="secondary">
                  {formatDate(sprint.startDate)} - {formatDate(sprint.endDate)}
                </Badge>

                {/* Delete Sprint */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSprint(sprint.id);
                  }}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 size={18}/>
                </button>
              </div>
            </div>

            {/* Sprint issues */}
            {sprint.isOpen && (
              <Droppable droppableId={sprint.id}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="border-t"
                  >
                    {sprint.issues.map(renderIssueCard)}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            )}
          </div>
        ))}

        {/* ---------------------- BACKLOG ---------------------- */}
        <div className="rounded-xl border bg-white">
          <div className="flex items-center justify-between p-4">
            <h2 className="text-lg font-medium flex items-center gap-2">
              <ChevronDown /> Backlog
            </h2>

            <Badge variant="secondary">{backlogIssues.length} issues</Badge>
          </div>

          <Droppable droppableId="backlog">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="border-t"
              >
                {backlogIssues.map(renderIssueCard)}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>

        <Button
          variant="outline"
          size="lg"
          className="w-full mt-4"
          onClick={addSprint}
        >
          Create Sprint <Plus />
        </Button>

        <Dialog open={!!issueToDelete} onOpenChange={(open) => !open && setIssueToDelete(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete issue</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete &quot;{issueToDelete?.title}&quot;? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setIssueToDelete(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Sprint detail dialog */}
        <Dialog open={!!sprintDetail} onOpenChange={(open) => !open && setSprintDetail(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{sprintDetail?.name}</DialogTitle>
              <DialogDescription>
                Sprint from {sprintDetail && formatDate(sprintDetail.startDate)} to{" "}
                {sprintDetail && formatDate(sprintDetail.endDate)}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary">{sprintDetail?.issues.length ?? 0} issues</Badge>
              </div>
              <div className="border rounded-lg divide-y max-h-[280px] overflow-y-auto">
                {sprintDetail?.issues.length ? (
                  sprintDetail.issues.map((issue) => (
                    <div
                      key={issue.id}
                      className="flex items-center justify-between px-4 py-3 text-sm"
                    >
                      <div>
                        <p className="font-medium">{issue.title}</p>
                        <p className="text-muted-foreground text-xs mt-0.5">
                          {issue.id} · {issue.priority}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {issue.priority}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                    No issues in this sprint
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSprintDetail(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DragDropContext>
  );
}
