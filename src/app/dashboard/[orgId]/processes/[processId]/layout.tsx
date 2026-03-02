"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, Plus, UserPlus, ChevronDownIcon, Calendar as CalendarIcon, ChevronsUpDown, Check, X, MessageSquare, Send, Info } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar"

import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectContent,
} from "@/components/ui/select";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import dynamic from "next/dynamic";
const FroalaEditor = dynamic(() => import("react-froala-wysiwyg"), { ssr: false });

// Only import CSS - JS plugins are loaded by react-froala-wysiwyg dynamically
import "froala-editor/css/froala_editor.pkgd.min.css";
import "froala-editor/css/froala_style.min.css";

import { Command, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Textarea } from "@/components/ui/textarea";
import Image from "next/image";

export default function ProcessLayout({ children }: { children: React.ReactNode }) {
  const { orgId, processId } = useParams();
  const pathname = usePathname();
  const { data: session } = useSession();
  const currentUserId = (session?.user as { id?: string })?.id ?? null;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "manager" | "member">("member");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processData, setProcessData] = useState<{ siteId: string } | null>(null);
  const [isLoadingProcess, setIsLoadingProcess] = useState(true);
  const [userRole, setUserRole] = useState<string>("member");

  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [editorContent, setEditorContent] = useState("");

  const [open, setOpen] = useState(false)
  const [date, setDate] = useState<Date | undefined>(undefined)
  const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false)

  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([])

  type Comment = {
    id: number
    author: string
    text: string
    createdAt: string
  }

  const [commentText, setCommentText] = useState("")
  const [comments, setComments] = useState<Comment[]>([])


  const handleAddComment = () => {
    if (!commentText.trim()) return

    const newComment: Comment = {
      id: Date.now(),
      author: "John Doe", // later replace with logged-in user
      text: commentText,
      createdAt: "Just now",
    }

    setComments((prev) => [newComment, ...prev])
    setCommentText("")
  }

  // Fetch current user role (Level 1 = owner/admin, Level 2 = manager, Level 3 = member)
  useEffect(() => {
    if (!orgId) return;
    apiClient
      .getSites(orgId as string)
      .then((data) => setUserRole(data.userRole || "member"))
      .catch(() => setUserRole("member"));
  }, [orgId]);

  // Create/Edit Issue form: any level (including Level 3 / member) can create and open issues
  const canAccessIssueForm = true;

  // Fetch metadata, sprints, and process users on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoadingMetadata(true);
        setIsLoadingUsers(true);
        const [titlesRes, tagsRes, sourcesRes, sprintsRes, usersRes] = await Promise.all([
          apiClient.getMetadata(orgId as string, "titles"),
          apiClient.getMetadata(orgId as string, "tags"),
          apiClient.getMetadata(orgId as string, "sources"),
          apiClient.getSprints(orgId as string, processId as string),
          apiClient.getProcessUsers(orgId as string, processId as string),
        ]);

        setTitles(titlesRes.titles || []);
        setTags(tagsRes.tags || []);
        setSources(sourcesRes.sources || []);
        setSprints(sprintsRes.sprints?.map((s: any) => ({ id: s.id, name: s.name })) || []);
        setProcessUsers(usersRes.users || []);
      } catch (error: any) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load data");
      } finally {
        setIsLoadingMetadata(false);
        setIsLoadingUsers(false);
      }
    };

    if (orgId && processId) {
      fetchData();
    }
  }, [orgId, processId]);

  // Listen for openIssueDialog event from board
  useEffect(() => {
    const handleOpenIssueDialog = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { issueId, orgId: eventOrgId, processId: eventProcessId } = customEvent.detail;

      // Only handle if it's for this process
      if (eventOrgId !== orgId || eventProcessId !== processId) return;

      // Open in create mode when no issueId (e.g. from timeline "add")
      if (!issueId) {
        setEditingIssue(null);
        setTitle("");
        setTag("");
        setSource("");
        setSelectedPriority("");
        setSelectedStatus("");
        setSelectedAssignees([]);
        setSelectedSprint("__backlog__");
        setPoints(0);
        setEditorContent("");
        setDate(undefined);
        setIsCreateDialogOpen(true);
        return;
      }

      try {
        setIsLoadingIssue(true);
        const response = await apiClient.getIssue(orgId as string, processId as string, issueId);
        const issue = response.issue;

        // Populate form with issue data
        setEditingIssue(issue);
        setTitle(issue.title || "");
        setTag(issue.tags && issue.tags.length > 0 ? issue.tags[0] : "");
        setSource(issue.source || "");
        setSelectedPriority(issue.priority || "");
        setSelectedStatus(issue.status || "");
        setSelectedAssignees(issue.assignee ? [issue.assignee] : []);
        setSelectedSprint(issue.sprintId || "__backlog__");
        setPoints(issue.points || 0);
        setEditorContent(issue.description || "");
        setDate(issue.deadline ? new Date(issue.deadline) : undefined);

        // Open dialog
        setIsCreateDialogOpen(true);
      } catch (error: any) {
        console.error("Error loading issue:", error);
        toast.error("Failed to load issue details");
      } finally {
        setIsLoadingIssue(false);
      }
    };

    window.addEventListener('openIssueDialog', handleOpenIssueDialog);
    return () => {
      window.removeEventListener('openIssueDialog', handleOpenIssueDialog);
    };
  }, [orgId, processId]);

  // Reset form when dialog closes
  const handleDialogOpenChange = (open: boolean) => {
    setIsCreateDialogOpen(open);
    if (!open) {
      // Reset form when dialog closes
      setEditingIssue(null);
      setTitle("");
      setTag("");
      setSource("");
      setSelectedPriority("");
      setSelectedStatus("");
      setSelectedAssignees([]);
      setSelectedSprint("__backlog__");
      setPoints(0);
      setEditorContent("");
      setDate(undefined);
      setCustomTitleMode(false);
      setCustomTagMode(false);
      setCustomSourceMode(false);
    }
  };

  const handleCustomTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(event.target.value);
  };

  const handleSaveCustomTitle = async () => {
    if (!title.trim()) return;

    try {
      await apiClient.addMetadata(orgId as string, "titles", title.trim());
      if (!titles.includes(title.trim())) {
        setTitles([...titles, title.trim()]);
      }
      setTitle(title.trim());
    setCustomTitleMode(false);
      toast.success("Title added successfully");
    } catch (error: any) {
      console.error("Error adding title:", error);
      toast.error(error.message || "Failed to add title");
    }
  };

  const tabs = [
    { name: "Summary", href: "summary" },
    { name: "Manage Issues", href: "manage-issues" },
    { name: "Backlog", href: "backlog" },
    { name: "Board", href: "board" },
    { name: "Calendar", href: "calendar" },
    { name: "Timeline", href: "timeline" },
    // { name: "Documents", href: "documents" },
    // { name: "Audits", href: "audits" },
    // { name: "Reports", href: "reports" },
    // { name: "Settings", href: "settings" },
  ];
  const [titles, setTitles] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [customTitleMode, setCustomTitleMode] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tag, setTag] = useState("");
  const [customTagMode, setCustomTagMode] = useState(false);
  const [sources, setSources] = useState<string[]>([]);
  const [source, setSource] = useState("");
  const [customSourceMode, setCustomSourceMode] = useState(false);
  const [sprints, setSprints] = useState<Array<{ id: string; name: string }>>([]);
  const [processUsers, setProcessUsers] = useState<Array<{ id: string; name: string; email: string; role: string }>>([]);

  // Form state
  const [selectedPriority, setSelectedPriority] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedAssignee, setSelectedAssignee] = useState<string>("");
  const [selectedSprint, setSelectedSprint] = useState<string>("__backlog__");
  const [points, setPoints] = useState<number>(0);
  const [isCreatingIssue, setIsCreatingIssue] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [editingIssue, setEditingIssue] = useState<any>(null); // Issue being edited
  const [isLoadingIssue, setIsLoadingIssue] = useState(false);
  const [isUpdatingIssue, setIsUpdatingIssue] = useState(false);

  // Only the assignee of an issue can edit it; others can only view (when opening existing issue)
  const canEditIssue =
    canAccessIssueForm &&
    (!editingIssue || editingIssue.assignee === currentUserId);
  const isViewOnly = !!editingIssue && !canEditIssue;

  const handleAddCustomTitle = () => {
    setCustomTitleMode(true);
  };

  const handleCustomTagChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setTag(e.target.value);

  const handleSaveCustomTag = async () => {
    if (!tag.trim()) return;

    try {
      await apiClient.addMetadata(orgId as string, "tags", tag.trim());
      if (!tags.includes(tag.trim())) {
        setTags([...tags, tag.trim()]);
      }
      setTag(tag.trim());
    setCustomTagMode(false);
      toast.success("Tag added successfully");
    } catch (error: any) {
      console.error("Error adding tag:", error);
      toast.error(error.message || "Failed to add tag");
    }
  };

  const handleCustomSourceChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setSource(e.target.value);

  const handleSaveCustomSource = async () => {
    if (!source.trim()) return;

    try {
      await apiClient.addMetadata(orgId as string, "sources", source.trim());
      if (!sources.includes(source.trim())) {
        setSources([...sources, source.trim()]);
      }
      setSource(source.trim());
    setCustomSourceMode(false);
      toast.success("Source added successfully");
    } catch (error: any) {
      console.error("Error adding source:", error);
      toast.error(error.message || "Failed to add source");
    }
  };

  // Handle issue creation/update form submission
  const handleCreateIssue = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isViewOnly) return;

    // Validate mandatory fields
    if (!title || !title.trim()) {
      toast.error("Title is required");
      return;
    }

    if (!tag || !tag.trim()) {
      toast.error("Tag is required");
      return;
    }

    if (!source || !source.trim()) {
      toast.error("Source is required");
      return;
    }

    // Validate assignee is mandatory
    if (!selectedAssignees || selectedAssignees.length === 0) {
      toast.error("At least one assignee is required");
      return;
    }

    // If editing, update the issue
    if (editingIssue) {
      setIsUpdatingIssue(true);
      try {
        const issueData: any = {
          title: title.trim(),
          description: editorContent || undefined,
          priority: selectedPriority || undefined,
          points: points || 0,
          assignee: selectedAssignees.length > 0 ? selectedAssignees[0] : undefined,
          tags: [tag.trim()],
          sprintId: selectedSprint === "__backlog__" ? null : (selectedSprint || null),
          status: selectedStatus || undefined,
          deadline: date ? date.toISOString() : null,
        };

        await apiClient.updateIssue(orgId as string, processId as string, editingIssue.id, issueData);

        toast.success("Issue updated successfully!");

        // Reset form and close dialog
        setEditingIssue(null);
        setTitle("");
        setTag("");
        setSource("");
        setSelectedPriority("");
        setSelectedStatus("");
        setSelectedAssignees([]);
        setSelectedSprint("__backlog__");
        setPoints(0);
        setEditorContent("");
        setDate(undefined);
        setIsCreateDialogOpen(false);

        // Trigger refresh - include status to help backlog filter out "in-progress" issues
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('issueUpdated', {
            detail: { 
              processId, 
              orgId, 
              issueId: editingIssue.id,
              status: issueData.status || selectedStatus || undefined
            }
          }));
        }
      } catch (error: any) {
        console.error("Error updating issue:", error);
        toast.error(error.message || "Failed to update issue");
      } finally {
        setIsUpdatingIssue(false);
      }
      return;
    }

    // Create new issue
    setIsCreatingIssue(true);

    try {
      // Prepare issue data
      const issueData: any = {
        title: title.trim(),
        tag: tag.trim(),
        source: source.trim(),
        description: editorContent || undefined,
        priority: selectedPriority || undefined,
        points: points || 0,
        assignee: selectedAssignees.length > 0 ? selectedAssignees[0] : undefined, // Use first assignee (API expects string)
        tags: [tag.trim()], // Store the selected tag in tags array
        sprintId: selectedSprint === "__backlog__" ? null : (selectedSprint || null),
        status: selectedStatus || "to-do", // Use selected status when creating (API may override to in-progress if sprint is set)
        deadline: date ? date.toISOString() : undefined,
      };

      await apiClient.createIssue(orgId as string, processId as string, issueData);

      toast.success("Issue created successfully!");

      // Reset form
      setTitle("");
      setTag("");
      setSource("");
      setSelectedPriority("");
      setSelectedStatus("");
      setSelectedAssignees([]);
      setSelectedSprint("__backlog__");
      setPoints(0);
      setEditorContent("");
      setDate(undefined);
      setIsCreateDialogOpen(false);

      // Trigger refresh of backlog page if needed
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('issueCreated', {
          detail: { processId, orgId }
        }));
      }
    } catch (error: any) {
      console.error("Error creating issue:", error);
      toast.error(error.message || "Failed to create issue");
    } finally {
      setIsCreatingIssue(false);
    }
  };



  const base = `/dashboard/${orgId}/processes/${processId}`;

  // Fetch process data to get siteId
  useEffect(() => {
    const fetchProcess = async () => {
      if (!orgId || !processId) return;
      
      try {
        setIsLoadingProcess(true);
        const process = await apiClient.getProcess(orgId as string, processId as string);
        setProcessData(process);
      } catch (error: any) {
        console.error("Error fetching process:", error);
        toast.error("Failed to load process information");
      } finally {
        setIsLoadingProcess(false);
      }
    };

    fetchProcess();
  }, [orgId, processId]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!orgId || !processId || !processData) {
      toast.error("Missing required information");
      return;
    }

    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsSubmitting(true);

    try {
      // Pass role directly (API accepts: owner, admin, manager, member)
      const result = await apiClient.createInvite({
        orgId: orgId as string,
        siteId: processData.siteId,
        processId: processId as string,
        email: email.trim(),
        role: role,
      });

      toast.success("Invitation sent successfully!");

      // Refresh process users list
      try {
        const usersRes = await apiClient.getProcessUsers(orgId as string, processId as string);
        setProcessUsers(usersRes.users || []);
      } catch (error) {
        console.error("Error refreshing users:", error);
        // Don't show error toast, invitation was successful
      }

      // Reset form and close dialog
      setEmail("");
      setRole("member");
      setDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to send invitation");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      {/* Header */}
      <Link
        href={`/dashboard/${orgId}/processes`}
        className="flex items-center gap-2 mb-5 cursor-pointer w-fit hover:opacity-80 transition-opacity"
      >
        <ArrowLeft /> Processes
      </Link>

      <div className="flex justify-between items-center mb-5">
        <div>
          <div className="flex items-center mb-5 gap-2">
            <span className="bg-[#2B7FFF] p-2 rounded text-white">
              <TrendingUp size={16} />
            </span>
            <h1 className="text-base font-bold capitalize">
              {processId?.toString().replaceAll("-", " ")}
            </h1>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Building the next generation mobile experience...
          </p>
        </div>

        {/* Create Issue Dialog - any level can create issues */}
        <Dialog open={isCreateDialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger asChild>
            <Button variant="default">
              <Plus size={16} /> New Issue
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-6xl! max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingIssue ? (isViewOnly ? "View Issue" : "Edit Issue") : "Create Issue"}</DialogTitle>
              <DialogDescription>
                {isViewOnly
                  ? "You are viewing this issue. Only the assignee can edit it."
                  : editingIssue
                  ? "Update the issue details."
                  : "Fill the details to create a new issue."}
              </DialogDescription>
            </DialogHeader>

            {/* FORM */}
            <form onSubmit={handleCreateIssue} className="space-y-4">

              {/* Title */}
              <div className="space-y-1">
                <Label className="mb-2">Title*</Label>

                {customTitleMode ? (
                  <div className="flex items-center gap-2 w-full">
                    <Input
                      placeholder="Enter custom title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full"
                      disabled={isViewOnly}
                    />

                    <Button
                      type="button"
                      onClick={async () => {
                        const value = title.trim();
                        if (!value) return;

                        try {
                          await apiClient.addMetadata(orgId as string, "titles", value);

                          setTitles((prev) =>
                            prev.includes(value) ? prev : [...prev, value]
                          );

                          setTitle(value); // ✅ auto-select
                          setCustomTitleMode(false);

                          toast.success("Title added successfully");
                        } catch (error: any) {
                          toast.error(error.message || "Failed to add title");
                        }
                      }}
                    >
                      Save
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCustomTitleMode(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 w-full">
                    <Select
                      value={title}
                      onValueChange={setTitle}
                      required
                      disabled={isViewOnly || isCreatingIssue || isUpdatingIssue || isLoadingIssue || isLoadingMetadata}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={isLoadingMetadata ? "Loading titles..." : "Select a title *"} />
                      </SelectTrigger>

                      <SelectContent>
                        {titles.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info size={24} />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Add to library</p>
                      </TooltipContent>
                    </Tooltip>

                    <Button
                      type="button"
                      className="w-40"
                      variant="dark"
                      onClick={() => setCustomTitleMode(true)}
                    >
                      Add Custom Title
                    </Button>
                  </div>
                )}
              </div>

              {/* Tag */}
              <div className="space-y-1">
                <Label className="mb-2">Tag*</Label>

                {customTagMode ? (
                  <div className="flex items-center gap-2 w-full">
                    <Input
                      placeholder="Enter custom tag"
                      value={tag}
                      onChange={(e) => setTag(e.target.value)}
                      className="w-full"
                      disabled={isViewOnly}
                    />

                    <Button
                      type="button"
                      onClick={async () => {
                        const value = tag.trim();
                        if (!value) return;

                        try {
                          await apiClient.addMetadata(orgId as string, "tags", value);

                          setTags((prev) =>
                            prev.includes(value) ? prev : [...prev, value]
                          );

                          setTag(value); // ✅ auto-select
                          setCustomTagMode(false);

                          toast.success("Tag added successfully");
                        } catch (error: any) {
                          toast.error(error.message || "Failed to add tag");
                        }
                      }}
                    >
                      Save
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCustomTagMode(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 w-full">
                    <Select value={tag} onValueChange={setTag} disabled={isViewOnly}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a tag *" />
                      </SelectTrigger>

                      <SelectContent>
                        {tags.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info size={24} />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Add to library</p>
                      </TooltipContent>
                    </Tooltip>

                    <Button
                      type="button"
                      className="w-40"
                      variant="dark"
                      onClick={() => setCustomTagMode(true)}
                    >
                      Add Custom Tag
                    </Button>
                  </div>
                )}
              </div>

              {/* Source */}
              <div className="space-y-1">
                <Label className="mb-2">Source*</Label>

                {customSourceMode ? (
                  <div className="flex items-center gap-2 w-full">
                    <Input
                      placeholder="Enter custom source"
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      className="w-full"
                      disabled={isViewOnly}
                    />

                    <Button
                      type="button"
                      onClick={async () => {
                        const value = source.trim();
                        if (!value) return;

                        try {
                          await apiClient.addMetadata(orgId as string, "sources", value);

                          setSources((prev) =>
                            prev.includes(value) ? prev : [...prev, value]
                          );

                          setSource(value); // ✅ auto-select
                          setCustomSourceMode(false);

                          toast.success("Source added successfully");
                        } catch (error: any) {
                          toast.error(error.message || "Failed to add source");
                        }
                      }}
                    >
                      Save
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCustomSourceMode(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 w-full">
                    <Select
                      value={source}
                      onValueChange={setSource}
                      required
                      disabled={isViewOnly || isCreatingIssue || isUpdatingIssue || isLoadingIssue || isLoadingMetadata}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={isLoadingMetadata ? "Loading sources..." : "Select a source *"} />
                      </SelectTrigger>

                      <SelectContent>
                        {sources.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info size={24} />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Add to library</p>
                      </TooltipContent>
                    </Tooltip>

                    <Button
                      type="button"
                      className="w-40"
                      variant="dark"
                      onClick={() => setCustomSourceMode(true)}
                    >
                      Add Custom Source
                    </Button>
                  </div>
                )}
              </div>

              {/* Priority & Status */}
              <div className="flex items-center gap-4">
                <div className="w-1/2">
                  <Label className="mb-2">Priority</Label>
                  <Select onValueChange={setSelectedPriority} value={selectedPriority} disabled={isViewOnly || isCreatingIssue || isUpdatingIssue || isLoadingIssue}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Medium (default)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-1/2">
                  <Label className="mb-2">Status</Label>
                  <Select
                    onValueChange={setSelectedStatus}
                    value={selectedStatus}
                    disabled={
                      isViewOnly ||
                      !!editingIssue ||
                      (selectedSprint && selectedSprint !== "__backlog__") ||
                      isCreatingIssue ||
                      isUpdatingIssue ||
                      isLoadingIssue
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={
                          editingIssue
                            ? undefined
                            : (selectedSprint && selectedSprint !== "__backlog__")
                              ? "In Progress (auto)"
                              : "To Do (default)"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="to-do">To Do</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                    </SelectContent>
                  </Select>
                  {editingIssue && (
                    <p className="text-xs text-gray-500 mt-1">
                      Status cannot be changed when editing. Create a new issue to set a different status.
                    </p>
                  )}
                  {!editingIssue && selectedSprint && selectedSprint !== "__backlog__" && (
                    <p className="text-xs text-gray-500 mt-1">
                      Status will be set to "In Progress" when sprint is selected
                    </p>
                  )}
                </div>
              </div>

              {/* Assignee & Sprint */}
              <div className="flex items-center gap-4">
                <div className="w-1/2 space-y-2">
                  <Label>Assignee*</Label>

                  {/* Selected Pills */}
                  {selectedAssignees.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedAssignees.map((id) => {
                        const user = processUsers.find((u) => u.id === id)
                        if (!user) return null

                        return (
                          <Badge
                            key={id}
                            variant="secondary"
                            className="flex items-center gap-1 pr-1"
                          >
                            {user.name}
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedAssignees((prev) =>
                                  prev.filter((v) => v !== id)
                                )
                              }
                              className="ml-1 rounded-full hover:bg-muted p-0.5"
                            >
                              <X className="h-3 w-3 text-red-500" />
                            </button>
                          </Badge>
                        )
                      })}
                    </div>
                  )}

                  {/* Selector */}
                  <Popover open={assigneePopoverOpen} onOpenChange={setAssigneePopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        disabled={isViewOnly || isCreatingIssue || isLoadingUsers || processUsers.length === 0}
                        className={cn(
                          "w-full justify-between",
                          selectedAssignees.length === 0 && "text-muted-foreground"
                        )}
                      >
                        {isLoadingUsers
                          ? "Loading users..."
                          : processUsers.length === 0
                            ? "No users available"
                            : "Select assignee(s)"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>

                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandEmpty>No users found.</CommandEmpty>
                        <CommandGroup>
                          {processUsers.map((user) => (
                            <CommandItem
                              key={user.id}
                              onSelect={() => {
                                setSelectedAssignees((prev) =>
                                  prev.includes(user.id)
                                    ? prev.filter((id) => id !== user.id)
                                    : [...prev, user.id]
                                )
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4 text-primary",
                                  selectedAssignees.includes(user.id)
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span>{user.name}</span>
                                {user.email && (
                                  <span className="text-xs text-muted-foreground">
                                    {user.email}
                                  </span>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>


                <div className="w-1/2">
                  <Label className="mb-2">Sprint</Label>
                  <Select
                    onValueChange={(value) => {
                      setSelectedSprint(value);
                      if (value && value !== "__backlog__") {
                        setSelectedStatus("in-progress");
                      } else {
                        setSelectedStatus("to-do");
                      }
                    }}
                    value={selectedSprint}
                    disabled={isViewOnly || isCreatingIssue || isLoadingMetadata}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={isLoadingMetadata ? "Loading sprints..." : "Select sprint (optional)"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__backlog__">None (Backlog)</SelectItem>
                      {sprints.map((sprint) => (
                        <SelectItem key={sprint.id} value={sprint.id}>{sprint.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    Leave empty to add to backlog
                  </p>
                </div>
              </div>

              {/* Due Date */}
              <div className="space-y-1">
                <Label className="mb-2">Due Date</Label>
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      id="date"
                      className="w-full justify-between"
                      disabled={isViewOnly || isCreatingIssue || isUpdatingIssue || isLoadingIssue}
                    >
                      {date ? date.toLocaleDateString() : "Select date"}
                      <ChevronDownIcon className="text-muted" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      captionLayout="dropdown"
                      onSelect={(date) => {
                        setDate(date)
                        setOpen(false)
                      }}
                      className="rounded-lg border"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Froala Editor */}
              <div>
                <Label className="mb-2">Description</Label>
                <FroalaEditor
                  tag="textarea"
                  model={editorContent}
                  onModelChange={setEditorContent}
                  config={{
                    heightMin: 200,
                    heightMax: 300,
                    widthMin: 200,
                    placeholderText: "Enter issue description...",
                    imageUploadURL: "/api/files/froala/upload",
                    imageUploadMethod: "POST",
                    imageAllowedTypes: ["jpeg", "jpg", "png", "webp"],
                    imageMaxSize: 5 * 1024 * 1024,
                    readOnly: isViewOnly,
                  }}
                />
              </div>

              {/* Comments Section */}
              <div className="space-y-1 border p-4 rounded-2xl">
                <div className="mb-3">
                  <Label className="mb-4 flex items-center gap-2">
                    <MessageSquare size={20} /> Comments
                  </Label>

                  <div className="pl-5">
                    <Textarea
                      placeholder="Add a comment..."
                      className="bg-[#F3F3F5] mb-3"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      disabled={isViewOnly}
                    />
                    <Button
                      type="button"
                      variant="dark"
                      className="mb-6"
                      onClick={handleAddComment}
                      disabled={isViewOnly}
                    >
                      <Send size={16} /> Comment
                    </Button>
                  </div>
                </div>

                {/* Comments List */}
                {comments.length === 0 && (
                  <p className="text-sm text-gray-500 pl-5">No comments yet</p>
                )}

                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="border p-3 rounded-2xl bg-white flex gap-3 mb-3"
                  >
                    <Image
                      src="/svgs/apple.svg"
                      alt="User avatar"
                      width={24}
                      height={24}
                      className="rounded-full h-6 w-6"
                    />

                    <div className="flex flex-col flex-1">
                      <h6 className="font-medium">{comment.author}</h6>
                      <p>{comment.text}</p>
                    </div>

                    <small className="text-gray-500 ml-auto">
                      {comment.createdAt}
                    </small>
                  </div>
                ))}
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={isCreatingIssue || isUpdatingIssue || isLoadingIssue}>
                    {isViewOnly ? "Close" : "Cancel"}
                  </Button>
                </DialogClose>
                {!isViewOnly && (
                  <Button type="submit" disabled={isCreatingIssue || isUpdatingIssue || isLoadingIssue}>
                    {isLoadingIssue
                      ? "Loading..."
                      : isUpdatingIssue
                        ? "Updating..."
                        : isCreatingIssue
                          ? "Creating..."
                          : editingIssue
                            ? "Update Issue"
                            : "Create Issue"}
                  </Button>
                )}
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b h-10 gap-6">
        <div className="flex gap-8 items-center h-full overflow-auto">
          {tabs.map((tab) => {
            const fullPath = `${base}/${tab.href}`;
            const isActive =
              pathname === fullPath ||
              pathname.startsWith(fullPath + "/") ||
              (tab.href === "summary" && pathname === base);

            return (
              <Link
                key={tab.href}
                href={fullPath}
                className={`text-sm h-full whitespace-nowrap flex items-center ${isActive ? "border-b-2 border-black font-semibold" : "text-gray-600"
                  }`}
              >
                {tab.name}
              </Link>
            );
          })}
        </div>

        {/* Add Member Dialog */}
        
        {/* <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="mb-2" disabled={isLoadingProcess}>
              <UserPlus size={18} /> Add Member
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Member</DialogTitle>
              <DialogDescription>
                Select role and enter email to send invitation link.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
              <div className="grid gap-3">
                  <Label htmlFor="role">Select Role</Label>
                  <Select
                    value={role}
                    onValueChange={(value) => setRole(value as "admin" | "manager" | "member")}
                    disabled={isSubmitting}
                  >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent> 
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-3">
                  <Label htmlFor="invitation-mail">Invitation Email</Label>
                  <Input
                    id="invitation-mail"
                    type="email"
                    placeholder="user@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
              </div>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
              </DialogClose>
                <Button
                  type="submit"
                  disabled={isSubmitting || !email || !processData}
                >
                  {isSubmitting ? "Sending..." : "Send Invitation"}
                </Button>
            </DialogFooter>
            </form>
          </DialogContent>
        </Dialog> */}
        
      </div>

      <div className="mt-6">{children}</div>
    </div>
  );
}
