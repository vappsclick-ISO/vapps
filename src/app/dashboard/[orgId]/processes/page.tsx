"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  EllipsisVertical,
  Funnel,
  LayoutGrid,
  List,
  Plus,
  Search,
  TrendingUp,
  UsersRound,
  Calendar as CalendarIcon,
  Check
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api-client";
import { format } from "date-fns";
import { toast } from "sonner";

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
import { AlertTriangle } from "lucide-react";
import { Label } from "@/components/ui/label"

import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";

interface Process {
  id: string;
  name: string;
  description?: string;
  siteId: string;
  createdAt: string;
  updatedAt: string;
  siteName?: string;
  siteCode?: string;
  siteLocation?: string;
}

interface Site {
  id: string;
  name: string;
  code: string;
  location: string;
  processes: Array<{ id: string; name: string; createdAt: string }>;
}

// Type for custom siteChanged event
interface SiteChangedEvent extends CustomEvent {
  detail: {
    siteId: string;
    orgId: string;
  };
}

export default function ProcessesListPage() {
  const [selectedLang, setSelectedLang] = useState("All Spaces");
  const [view, setView] = useState<"card" | "list">("card");
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const params = useParams();
  const orgId = params.orgId as string;
  const router = useRouter();
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreatingProcess, setIsCreatingProcess] = useState(false);
  const [editingProcess, setEditingProcess] = useState<Process | null>(null);
  const [canManageProcesses, setCanManageProcesses] = useState(false);
  const [deletingProcess, setDeletingProcess] = useState<Process | null>(null);
  const [isDeletingProcess, setIsDeletingProcess] = useState(false);

  // Fetch processes for a specific site
  const fetchProcessesForSite = useCallback(async (siteId: string, showLoading: boolean = true) => {
    try {
      if (showLoading) {
        setIsLoading(true);
      }
      // Add timestamp to force fresh fetch (bypasses browser cache, server cache is handled by backend)
      const response = await apiClient.getProcesses(orgId, siteId);
      setProcesses(response.processes || []);
    } catch (error: any) {
      console.error("Error fetching processes:", error);
      setProcesses([]);
      // Error is already handled by apiClient interceptor, but you can add toast notification here if needed
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, [orgId]);

  // Fetch permissions
  useEffect(() => {
    if (!orgId) return;
    const fetchPermissions = async () => {
      try {
        const res = await apiClient.get<{
          currentUserPermissions: {
            manage_processes: boolean;
          };
        }>(`/organization/${orgId}/permissions`);
        setCanManageProcesses(res.currentUserPermissions?.manage_processes ?? false);
      } catch (e: any) {
        console.error("Failed to fetch permissions:", e);
        setCanManageProcesses(false);
      }
    };
    fetchPermissions();
  }, [orgId]);

  // Fetch sites and processes
  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        // Fetch sites
        const sitesResponse = await apiClient.getSites(orgId);
        const sitesData = sitesResponse.sites || [];
        
        if (!isMounted) return;
        
        setSites(sitesData);

        // Get selected site from localStorage or use first site
        let selectedSite = null;
        if (typeof window !== 'undefined') {
          const storedSite = localStorage.getItem(`selectedSite_${orgId}`);
          if (storedSite) {
            try {
              const parsedSite = JSON.parse(storedSite);
              // Verify the site still exists in the fetched sites
              selectedSite = sitesData.find((s: Site) => s.id === parsedSite.id);
            } catch (e) {
              console.error("Error parsing stored site:", e);
            }
          }
        }

        // If no stored site or stored site not found, use first site
        if (!selectedSite && sitesData.length > 0) {
          selectedSite = sitesData[0];
        }

        if (selectedSite) {
          setSelectedSiteId(selectedSite.id);
          await fetchProcessesForSite(selectedSite.id, true);
        } else {
          if (isMounted) {
            setProcesses([]);
            setIsLoading(false);
          }
        }
      } catch (error) {
        console.error("Error fetching sites:", error);
        if (isMounted) {
          setProcesses([]);
          setIsLoading(false);
        }
      }
    };

    fetchData();

    // Listen for site changes from sidebar
    const handleSiteChange = (event: Event) => {
      const customEvent = event as SiteChangedEvent;
      if (customEvent.detail.orgId === orgId && isMounted) {
        const newSiteId = customEvent.detail.siteId;
        setSelectedSiteId((prevSiteId) => {
          // Only show loading if switching to a different site
          const shouldShowLoading = newSiteId !== prevSiteId;
          fetchProcessesForSite(newSiteId, shouldShowLoading);
          return newSiteId;
        });
      }
    };

    window.addEventListener('siteChanged', handleSiteChange);

    // Listen for process creation events to refresh the list
    const handleProcessCreated = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail.orgId === orgId && isMounted) {
        const siteId = customEvent.detail.siteId;
        // Refresh processes if it's for the current site
        if (siteId === selectedSiteId) {
          fetchProcessesForSite(siteId, false);
        }
      }
    };

    window.addEventListener('processCreated', handleProcessCreated);

    // Listen for process deletion events to refresh the list
    const handleProcessDeleted = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail.orgId === orgId && isMounted) {
        const siteId = customEvent.detail.siteId;
        // Refresh processes if it's for the current site
        // Note: This listener may use a stale selectedSiteId, but the optimistic
        // update in handleDeleteProcess ensures immediate UI feedback
        if (siteId === selectedSiteId) {
          fetchProcessesForSite(siteId, false);
        }
      }
    };

    window.addEventListener('processDeleted', handleProcessDeleted);

    return () => {
      isMounted = false;
      window.removeEventListener('siteChanged', handleSiteChange as EventListener);
      window.removeEventListener('processCreated', handleProcessCreated);
      window.removeEventListener('processDeleted', handleProcessDeleted);
    };
  }, [orgId, fetchProcessesForSite, selectedSiteId]);

  // Filter processes based on search - memoized to prevent unnecessary recalculations
  const filteredProcesses = useMemo(() => {
    return processes.filter((process) =>
      process.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [processes, searchQuery]);

  // Handle create/edit process form submission
  const handleCreateProcess = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!selectedSiteId) {
      toast.error("Please select a site first");
      return;
    }

    setIsCreatingProcess(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const name = (formData.get("name") as string)?.trim();
    const description = (formData.get("description") as string)?.trim();

    if (!name || name.length === 0) {
      toast.error("Process name is required");
      setIsCreatingProcess(false);
      return;
    }

    try {
      if (editingProcess) {
        // Update existing process
        const updatedProcess = await apiClient.updateProcess(orgId, editingProcess.id, {
          name,
          description: description || undefined,
        });

        // Optimistically update the process in the UI immediately
        if (updatedProcess.process) {
          setProcesses((prevProcesses) =>
            prevProcesses.map((p) =>
              p.id === editingProcess.id
                ? { ...p, ...updatedProcess.process }
                : p
            )
          );
        }

        toast.success("Process updated successfully!");
      } else {
        // Create new process
        await apiClient.createProcess(orgId, {
          name,
          description: description || undefined,
          siteId: selectedSiteId,
        });

        toast.success("Process created successfully!");

        // Trigger sidebar refresh by dispatching a custom event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('processCreated', { 
            detail: { siteId: selectedSiteId, orgId } 
          }));
        }
      }
      
      // Reset form
      form.reset();
      setIsCreateDialogOpen(false);
      setEditingProcess(null);

      // Refresh processes list in the background to ensure consistency
      fetchProcessesForSite(selectedSiteId, false).catch((error) => {
        console.error("Error refreshing processes after save:", error);
        // If refresh fails, we've already optimistically updated the UI
      });
    } catch (error: any) {
      console.error(`Error ${editingProcess ? 'updating' : 'creating'} process:`, error);
      toast.error(error.message || `Failed to ${editingProcess ? 'update' : 'create'} process`);
    } finally {
      setIsCreatingProcess(false);
    }
  };

  // Handle edit process click
  const handleEditProcess = (process: Process) => {
    setEditingProcess(process);
    setIsCreateDialogOpen(true);
  };

  // Reset edit state when dialog closes
  const handleDialogOpenChange = (open: boolean) => {
    setIsCreateDialogOpen(open);
    if (!open) {
      setEditingProcess(null);
    }
  };

  // Handle delete process
  const handleDeleteProcess = async () => {
    if (!deletingProcess || !selectedSiteId) return;

    setIsDeletingProcess(true);
    const processIdToDelete = deletingProcess.id;
    
    try {
      const result = await apiClient.deleteProcess(orgId, processIdToDelete);
      
      // Optimistically remove the process from the UI immediately
      setProcesses((prevProcesses) => 
        prevProcesses.filter((p) => p.id !== processIdToDelete)
      );
      
      toast.success(result.message || "Process deleted successfully");

      // Trigger sidebar refresh by dispatching a custom event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('processDeleted', { 
          detail: { siteId: selectedSiteId, orgId, processId: processIdToDelete } 
        }));
      }

      // Refresh processes list in the background to ensure consistency
      fetchProcessesForSite(selectedSiteId, false).catch((error) => {
        console.error("Error refreshing processes after deletion:", error);
        // If refresh fails, we've already optimistically updated the UI
      });
      
      setDeletingProcess(null);
    } catch (error: any) {
      console.error("Error deleting process:", error);
      toast.error(error.message || "Failed to delete process");
      // If deletion fails, refresh the list to ensure UI is in sync
      fetchProcessesForSite(selectedSiteId, false).catch((refreshError) => {
        console.error("Error refreshing processes after failed deletion:", refreshError);
      });
    } finally {
      setIsDeletingProcess(false);
    }
  };

  // Calculate stats
  const totalProcesses = processes.length;
  const activeProjects = 0; // Not in DB yet - will be implemented with task management
  const totalIssues = 0; // Not in DB yet - will be implemented with task management
  const avgProgress = 0; // Not in DB yet - will be implemented with task management

  return (
    <div className="Processes p-2">
      {/* Header */}
      <div className="flex justify-between">
        <div>
          <h1 className="text-md font-bold mb-2">Processes</h1>
          <p className="text-base">Manage your projects and processes</p>
        </div>
        {canManageProcesses && (
          <Dialog open={isCreateDialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(true)}>
                <Plus /> Create Process
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
            <form key={editingProcess?.id || "create"} onSubmit={handleCreateProcess}>
              <DialogHeader>
                <DialogTitle>{editingProcess ? "Edit Process" : "Create New Process"}</DialogTitle>
                <DialogDescription>
                  {editingProcess 
                    ? "Update the process details"
                    : "Set up a new process for your project or team"
                  }
                  {!editingProcess && selectedSiteId && sites.length > 0 && (
                    <span className="block mt-1 text-sm text-gray-600">
                      Site: {sites.find(s => s.id === selectedSiteId)?.name || "Current site"}
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-3">
                  <Label htmlFor="process-name">Process Name *</Label>
                  <Input 
                    id="process-name" 
                    name="name" 
                    placeholder="e.g., Mobile App Development" 
                    required
                    disabled={isCreatingProcess}
                    defaultValue={editingProcess?.name || ""}
                  />
                </div>
                <div className="grid gap-3">
                  <Label htmlFor="process-description">Description</Label>
                  <Textarea 
                    id="process-description" 
                    name="description" 
                    placeholder="Brief description of what this process is for..." 
                    rows={3}
                    disabled={isCreatingProcess}
                    defaultValue={editingProcess?.description || ""}
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={isCreatingProcess}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isCreatingProcess || (!editingProcess && !selectedSiteId)}>
                  {isCreatingProcess 
                    ? (editingProcess ? "Updating..." : "Creating...") 
                    : (editingProcess ? "Update Process" : "Create Process")
                  }
                </Button>
              </DialogFooter>
            </form>
            </DialogContent>
          </Dialog>
        )}

      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row justify-between my-5 gap-4">
        <div className="flex-1 flex">
          <div className="relative w-full max-w-md">
            <Search size={18} className="absolute top-1/2 -translate-y-1/2 left-3 text-gray-500" />
            <Input
              className="pl-10 bg-[#F3F3F5]"
              placeholder="Search tasks, docs, processes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex gap-2">
                <Funnel size={18} /> Filter By
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              className="w-44 rounded-lg shadow-md border bg-white"
            >

              {["All Spaces", "Active", "Planning", "On Hold", "Completed"].map((lang) => (
                <DropdownMenuItem
                  key={lang}
                  onClick={() => setSelectedLang(lang)}
                  className="flex justify-between items-center cursor-pointer text-[#0A0A0A] text-sm"
                >
                  {lang}

                  {selectedLang === lang && (
                    <Check className="h-4 w-4 text-black" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            onClick={() => setView(view === "card" ? "list" : "card")}
            className="flex items-center gap-2 min-w-[120px]"
          >
            {view === "card" ? <List size={18} /> : <LayoutGrid size={18} />}
            {view === "card" ? "List View" : "Grid View"}
          </Button>
        </div>
      </div>

      {/* Top Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <div className="border rounded-lg p-4">
          <p className="text-[#717182]">Total Processes</p>
          <span className="font-semibold">{totalProcesses}</span>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-[#717182]">Active Projects</p>
          <span className="font-semibold">{activeProjects}</span>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-[#717182]">Total Issues</p>
          <span className="font-semibold">{totalIssues}</span>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-[#717182]">Avg. Progress</p>
          <span className="font-semibold">{avgProgress}%</span>
        </div>
      </div>

      {/* Process Cards */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500 mt-6">Loading processes...</div>
      ) : filteredProcesses.length === 0 ? (
        <div className="text-center py-8 text-gray-500 mt-6">
          {searchQuery 
            ? "No processes found matching your search." 
            : selectedSiteId 
              ? "No processes available for this site. Create your first process to get started."
              : "No processes available. Create your first process to get started."}
        </div>
      ) : view === "card" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {filteredProcesses.map((process) => {
            const processCreatedDate = new Date(process.createdAt);
            const gradients = [
              "bg-[linear-gradient(135deg,#615FFF_0%,#9810FA_100%)]",
              "bg-[linear-gradient(135deg,#2B7FFF_0%,#4F39F6_100%)]",
              "bg-[linear-gradient(135deg,#00C950_0%,#009966_100%)]",
            ];
            const gradientIndex = filteredProcesses.indexOf(process) % gradients.length;

            return (
              <div
                key={process.id}
                onClick={() => router.push(`/dashboard/${orgId}/processes/${process.id}`)}
                className="border rounded-lg p-4 hover:shadow-md transition flex flex-col justify-between cursor-pointer"
              >
                <div className="flex justify-between items-center mb-4">
                  <span className={`${gradients[gradientIndex]} p-2 rounded-lg text-white`}>
                    <TrendingUp size={18} />
                  </span>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="p-2 rounded hover:bg-gray-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <EllipsisVertical size={18} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canManageProcesses && (
                        <>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditProcess(process); }}>
                            Edit Process
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setDeletingProcess(process); 
                            }}
                            className="text-red-600 focus:text-red-600"
                          >
                            Delete Process
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuItem onClick={(e) => e.stopPropagation()}>Process Settings</DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => e.stopPropagation()}>Share</DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => e.stopPropagation()}>Archive</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Card Content */}
                <div className="flex flex-col gap-3">
                  <h3 className="text-lg font-semibold">{process.name}</h3>
                  <p className="text-sm text-gray-500">
                    {process.siteName ? `${process.siteName} - ${process.siteLocation}` : "Process"}
                  </p>

                  <div className="flex gap-2">
                    <Badge>Active</Badge>
                  </div>

                  <div className="mt-2">
                    <ul className="flex justify-between text-sm text-gray-600 mb-1">
                      <li>Progress</li>
                      <li>{avgProgress}%</li>
                    </ul>
                    <Progress value={avgProgress} />
                  </div>

                  <div className="flex justify-between items-center mt-2 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <CalendarIcon size={16} />
                      <span>{format(processCreatedDate, "MMM dd, yyyy")}</span>
                    </div>
                    <Badge variant="outline">{totalIssues} issues</Badge>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    <UsersRound size={20} />
                    <div className="flex -space-x-2">
                      {/* Placeholder avatars - will be replaced when members are implemented */}
                      <Avatar className="h-8 w-8 ring-2 ring-white">
                        <AvatarFallback className="bg-[#E0E7FF] text-[#432DD7] text-xs">P</AvatarFallback>
                      </Avatar>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-black opacity-50 absolute inset-0" onClick={() => setEditModalOpen(false)}></div>

          <div className="bg-white rounded-lg p-6 z-10 max-w-lg w-full">
            <h2 className="text-lg font-semibold mb-4">Create New Issue</h2>

            <form>
              {/* Issue Type */}
              <div className="mb-4">
                <label className="block text-sm font-medium">Issue Type *</label>
                <Select>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Task" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="task">Task</SelectItem>
                    <SelectItem value="bug">Bug</SelectItem>
                    <SelectItem value="story">Story</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Title */}
              <div className="mb-4">
                <label className="block text-sm font-medium">Title *</label>
                <Input placeholder="Brief description of the issue" />
              </div>

              {/* Description */}
              <div className="mb-4">
                <label className="block text-sm font-medium">Description</label>
                <Textarea placeholder="Detailed description..." />
              </div>

              <div className="flex items-center gap-4">
                {/* Priority */}
                <div className="w-1/2 mb-4">
                  <label className="block text-sm font-medium">Priority</label>
                  <Select>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Medium" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Status */}
                <div className="w-1/2 mb-4">
                  <label className="block text-sm font-medium">Status</label>
                  <Select>
                    <SelectTrigger className="w-full"><SelectValue placeholder="To Do" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="to-do">To Do</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Assignee */}
                <div className="w-1/2 mb-4">
                  <label className="block text-sm font-medium">Assignee</label>
                  <Select>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select assignee" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="assignee1">Assignee 1</SelectItem>
                      <SelectItem value="assignee2">Assignee 2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-1/2 mb-4">
                  <label className="block text-sm font-medium">Sprint</label>
                  <Select>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select sprint" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sprint1">Sprint 1</SelectItem>
                      <SelectItem value="sprint2">Sprint 2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Due Date */}
                <div className="w-full mb-4">
                  <label className="block text-sm font-medium">Due Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dueDate ? format(dueDate, "yyyy/MM/dd") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <DayPicker
                        className="p-4"
                        mode="single"
                        selected={dueDate ?? undefined}
                        onSelect={(date) => setDueDate(date ?? null)}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-4 mt-4">
                <Button variant="outline" onClick={() => setEditModalOpen(false)}>
                  Cancel
                </Button>
                <Button>Create Issue</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {view === "list" && !isLoading && (
        <div className="processes-list flex flex-col gap-6 mt-6">
          {filteredProcesses.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchQuery 
                ? "No processes found matching your search." 
                : selectedSiteId 
                  ? "No processes available for this site."
                  : "No processes available."}
            </div>
          ) : (
            filteredProcesses.map((process) => {
              const processCreatedDate = new Date(process.createdAt);
              const gradients = [
                "bg-[linear-gradient(135deg,#615FFF_0%,#9810FA_100%)]",
                "bg-[linear-gradient(135deg,#2B7FFF_0%,#4F39F6_100%)]",
                "bg-[linear-gradient(135deg,#00C950_0%,#009966_100%)]",
              ];
              const gradientIndex = filteredProcesses.indexOf(process) % gradients.length;

              return (
                <div
                  key={process.id}
                  onClick={() => router.push(`/dashboard/${orgId}/processes/${process.id}`)}
                  className="list border border-gray-200 rounded-lg p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:shadow-md transition cursor-pointer"
                >
                  {/* Left */}
                  <div className="flex items-start md:items-center gap-4 flex-1">
                    <span className={`${gradients[gradientIndex]} p-2 rounded-full text-white flex items-center justify-center`}>
                      <TrendingUp size={18} />
                    </span>

                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 mb-1">
                        <h3 className="text-lg font-semibold">{process.name}</h3>
                        <div className="flex gap-2 mt-1 sm:mt-0">
                          <Badge variant="default">Active</Badge>
                        </div>
                      </div>

                      <p className="text-sm text-gray-500">
                        {process.siteName ? `${process.siteName} - ${process.siteLocation}` : "Process"}
                      </p>
                    </div>
                  </div>

                  {/* Right */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-3 md:mt-0">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <CalendarIcon size={16} />
                      <span>{format(processCreatedDate, "MMM dd, yyyy")}</span>
                    </div>

                    <div className="progress-bar w-full sm:w-40">
                      <p className="text-sm text-gray-600 mb-1">Progress: {avgProgress}%</p>
                      <Progress value={avgProgress} />
                    </div>

                    <Badge variant="outline" className="text-sm">{totalIssues} issues</Badge>

                    <div className="flex -space-x-2">
                      <Avatar className="h-8 w-8 ring-2 ring-white rounded-full">
                        <AvatarFallback className="bg-[#E0E7FF] text-[#432DD7] rounded-full text-xs">P</AvatarFallback>
                      </Avatar>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Delete Process Dialog */}
      <Dialog open={!!deletingProcess} onOpenChange={(open) => !open && setDeletingProcess(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Delete Process
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingProcess?.name}"? This action cannot be undone and will permanently delete the process and all associated data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button 
                type="button" 
                variant="outline" 
                disabled={isDeletingProcess}
                onClick={() => setDeletingProcess(null)}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button 
              type="button"
              variant="destructive"
              onClick={handleDeleteProcess}
              disabled={isDeletingProcess}
            >
              {isDeletingProcess ? "Deleting..." : "Delete Process"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
