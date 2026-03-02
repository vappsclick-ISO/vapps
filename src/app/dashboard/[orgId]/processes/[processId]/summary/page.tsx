"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Calendar, Clock, CheckCircle2, Circle, PlayCircle, FileText, UserPlus, GitBranch } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

type Activity = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  entityType: string;
  entityId?: string;
  entityTitle?: string;
  details: Record<string, any>;
  createdAt: string;
};

type IssueStats = {
  toDo: number;
  inProgress: number;
  completed: number;
  total: number;
  completionPercentage: number;
};

type Sprint = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
};

type ProcessUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export default function SummaryPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const processId = params.processId as string;

  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<IssueStats>({
    toDo: 0,
    inProgress: 0,
    completed: 0,
    total: 0,
    completionPercentage: 0,
  });
  const [activities, setActivities] = useState<Activity[]>([]);
  const [upcomingSprints, setUpcomingSprints] = useState<Sprint[]>([]);
  const [teamMembers, setTeamMembers] = useState<ProcessUser[]>([]);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch all data in parallel
      const [issuesRes, activityRes, sprintsRes, usersRes] = await Promise.all([
        apiClient.getIssues(orgId, processId),
        apiClient.getActivityLog(orgId, processId, 20),
        apiClient.getSprints(orgId, processId),
        apiClient.getProcessUsers(orgId, processId),
      ]);

      // Calculate statistics
      const allIssues = issuesRes.issues || [];
      const toDo = allIssues.filter((i: any) => i.status === "to-do").length;
      const inProgress = allIssues.filter((i: any) => i.status === "in-progress").length;
      const completed = allIssues.filter((i: any) => i.status === "done").length;
      const total = allIssues.length;
      const completionPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

      setStats({
        toDo,
        inProgress,
        completed,
        total,
        completionPercentage,
      });

      // Set activities
      setActivities(activityRes.activities || []);

      // Get upcoming sprints (sprints that haven't ended yet)
      const now = new Date();
      const upcoming = (sprintsRes.sprints || [])
        .filter((s: Sprint) => new Date(s.endDate) >= now)
        .sort((a: Sprint, b: Sprint) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
        .slice(0, 4);

      setUpcomingSprints(upcoming);

      // Set team members
      setTeamMembers(usersRes.users || []);
    } catch (error: any) {
      console.error("Error fetching summary data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setIsLoading(false);
    }
  }, [orgId, processId]);

  useEffect(() => {
    if (orgId && processId) {
      fetchData();
    }
  }, [orgId, processId, fetchData]);

  // Listen for updates to refresh data
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
        fetchData();
      }
    };

    window.addEventListener("issueCreated", handleIssueCreated);
    window.addEventListener("issueUpdated", handleIssueUpdated);

    return () => {
      window.removeEventListener("issueCreated", handleIssueCreated);
      window.removeEventListener("issueUpdated", handleIssueUpdated);
    };
  }, [orgId, processId, fetchData]);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const getActivityIcon = (action: string, entityType: string) => {
    if (entityType === "issue") {
      if (action.includes("created")) return <Circle className="h-4 w-4 text-blue-500" />;
      if (action.includes("status_changed")) return <PlayCircle className="h-4 w-4 text-orange-500" />;
      if (action.includes("completed") || action.includes("done")) return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      return <FileText className="h-4 w-4 text-gray-500" />;
    }
    if (entityType === "sprint") {
      return <GitBranch className="h-4 w-4 text-purple-500" />;
    }
    if (entityType === "review") {
      return <FileText className="h-4 w-4 text-indigo-500" />;
    }
    return <Circle className="h-4 w-4 text-gray-500" />;
  };

  const getActivityMessage = (activity: Activity) => {
    const userName = activity.userName || activity.userEmail || "Unknown User";
    const entityTitle = activity.entityTitle || activity.entityId || "item";

    switch (activity.action) {
      case "issue.created":
        return (
          <>
            <span className="font-medium">{userName}</span> created issue{" "}
            <span className="font-medium">{entityTitle}</span>
          </>
        );
      case "issue.updated":
        return (
          <>
            <span className="font-medium">{userName}</span> updated issue{" "}
            <span className="font-medium">{entityTitle}</span>
          </>
        );
      case "issue.status_changed":
        const newStatus = activity.details?.newStatus || "updated";
        return (
          <>
            <span className="font-medium">{userName}</span> changed status of{" "}
            <span className="font-medium">{entityTitle}</span> to {newStatus}
          </>
        );
      case "issue.assigned":
        const assignee = activity.details?.assignee || "someone";
        return (
          <>
            <span className="font-medium">{userName}</span> assigned{" "}
            <span className="font-medium">{entityTitle}</span> to {assignee}
          </>
        );
      case "sprint.created":
        return (
          <>
            <span className="font-medium">{userName}</span> created sprint{" "}
            <span className="font-medium">{entityTitle}</span>
          </>
        );
      case "review.submitted":
        return (
          <>
            <span className="font-medium">{userName}</span> submitted review for{" "}
            <span className="font-medium">{entityTitle}</span>
          </>
        );
      case "verification.completed":
        return (
          <>
            <span className="font-medium">{userName}</span> completed verification for{" "}
            <span className="font-medium">{entityTitle}</span>
          </>
        );
      default:
        return (
          <>
            <span className="font-medium">{userName}</span> {activity.action} {entityTitle}
          </>
        );
    }
  };

  const getUserInitials = (name: string, email: string) => {
    if (name) {
      const parts = name.split(" ");
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return "??";
  };

  const getUserAvatarColor = (userId: string) => {
    const colors = ["#8B5CF6", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#6366F1"];
    const index = parseInt(userId.slice(-1), 16) % colors.length;
    return colors[index];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Top Progress Cards */}
      <div className="summary-progress-cards grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { title: "To Do", value: stats.toDo.toString(), progress: stats.total > 0 ? (stats.toDo / stats.total) * 100 : 0, color: "#6A7282" },
          { title: "In Progress", value: stats.inProgress.toString(), progress: stats.total > 0 ? (stats.inProgress / stats.total) * 100 : 0, color: "#2B7FFF" },
          { title: "Completed", value: stats.completed.toString(), progress: stats.total > 0 ? (stats.completed / stats.total) * 100 : 0, color: "#10B981" },
          { title: "Completion", value: `${stats.completionPercentage}%`, progress: stats.completionPercentage, color: "#A3A3A3" },
        ].map((card, idx) => (
          <div
            key={idx}
            className="card border border-[#0000001A] rounded-lg p-4 flex flex-col justify-between"
          >
            <p className="text-[#717182] text-sm">{card.title}</p>
            <div className="mt-2">
              <span className="text-base font-semibold">{card.value}</span>
              <Progress
                value={card.progress}
                color={card.color}
                trackColor="#E5E7EB"
                className="mt-2"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Cards */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left Column */}
        <div className="flex-1 flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest updates from your team</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {activities.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No activity yet</p>
              ) : (
                activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 border-b border-[#0000001A] pb-4 last:border-b-0"
                  >
                    <Avatar className="h-8 w-8" style={{ backgroundColor: getUserAvatarColor(activity.userId) }}>
                      <AvatarFallback className="text-white text-xs">
                        {getUserInitials(activity.userName, activity.userEmail)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 flex items-start gap-2">
                      <div className="mt-0.5">{getActivityIcon(activity.action, activity.entityType)}</div>
                      <div className="flex-1">
                        <p className="text-[#6A7282] text-sm">
                          {getActivityMessage(activity)}
                        </p>
                        <span className="text-[#6A7282] text-xs flex items-center gap-1 mt-1">
                          <Clock size={12} /> {formatTimeAgo(activity.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upcoming Milestones</CardTitle>
              <CardDescription>Key dates and deliverables</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {upcomingSprints.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No upcoming sprints</p>
              ) : (
                upcomingSprints.map((sprint) => (
                  <div
                    key={sprint.id}
                    className="flex items-center justify-between gap-3 border-b border-[#0000001A] pb-4 last:border-b-0"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-[#E5E7EB] text-[#364153]">
                          <GitBranch className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <p className="text-[#6A7282]">
                          <span className="text-[#0A0A0A] me-2 font-medium">{sprint.name}</span>
                        </p>
                        <span className="text-[#6A7282] text-xs flex items-center gap-1">
                          <Calendar size={12} /> {formatDate(sprint.startDate)} - {formatDate(sprint.endDate)}
                        </span>
                      </div>
                    </div>
                    <Button variant="dark" size="sm">
                      On Track
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="flex-1 flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>Active team members</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {teamMembers.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No team members yet</p>
              ) : (
                teamMembers.map((member) => (
                  <div key={member.id} className="flex items-center gap-3">
                    <Avatar className="h-8 w-8" style={{ backgroundColor: getUserAvatarColor(member.id) }}>
                      <AvatarFallback className="text-white text-xs">
                        {getUserInitials(member.name, member.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <p className="text-[#0A0A0A] font-medium">{member.name || member.email}</p>
                      <span className="text-[#6A7282] text-xs capitalize">{member.role}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Space Statistics</CardTitle>
              <CardDescription>Overall progress</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress
                value={stats.completionPercentage}
                color="#364153"
                trackColor="#E5E7EB"
                className="mb-4"
              />
              <div className="flex justify-between text-xs text-[#6A7282]">
                <span>Total tasks</span>
                <span>{stats.total}</span>
              </div>
              <div className="flex justify-between text-xs text-[#6A7282]">
                <span>Open tasks</span>
                <span>{stats.toDo + stats.inProgress}</span>
              </div>
              <div className="flex justify-between text-xs text-[#6A7282]">
                <span>Sync Status</span>
                <Badge variant="outline">Synced</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
