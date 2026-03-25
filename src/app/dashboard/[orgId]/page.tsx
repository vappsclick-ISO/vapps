"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ArrowUp, ChartNoAxesCombined, CircleAlert, CircleCheckBig, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart";

import { CartesianGrid, Line, LineChart, XAxis, Pie, PieChart, Cell } from "recharts";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";

const chartConfig = {
    created: { label: "Issues created", color: "var(--chart-1)" },
    completed: { label: "Issues completed", color: "var(--chart-2)" },
    count: { label: "Count", color: "var(--chart-1)" },
} satisfies ChartConfig;

type ActivityItem = {
  id: string;
  processId: string | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  entityTitle: string | null;
  details?: { newStatus?: string; assignee?: string; statusLabel?: string };
  createdAt: string;
  processName?: string | null;
};

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? "s" : ""} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? "s" : ""} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay !== 1 ? "s" : ""} ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getActivityMessage(activity: ActivityItem): React.ReactNode {
  const userName = activity.userName || activity.userEmail || "Someone";
  const entityTitle = activity.entityTitle || activity.entityId || "item";
  const processCtx = activity.processName ? ` in ${activity.processName}` : "";

  if (activity.entityType === "audit_plan") {
    const label = activity.details?.statusLabel || activity.action?.replace("audit_plan.", "") || "updated";
    return (
      <>
        <span className="text-[#0A0A0A] font-medium">Audit</span>
        <span className="text-[#6A7282]"> {label}: {entityTitle}</span>
      </>
    );
  }

  switch (activity.action) {
    case "issue.created":
      return <><span className="text-[#0A0A0A] font-medium">{userName}</span><span className="text-[#6A7282]"> created issue {entityTitle}{processCtx}</span></>;
    case "issue.updated":
      return <><span className="text-[#0A0A0A] font-medium">{userName}</span><span className="text-[#6A7282]"> updated issue {entityTitle}{processCtx}</span></>;
    case "issue.status_changed":
      const newStatus = activity.details?.newStatus || "updated";
      return <><span className="text-[#0A0A0A] font-medium">{userName}</span><span className="text-[#6A7282]"> changed status of {entityTitle} to {newStatus}{processCtx}</span></>;
    case "issue.assigned":
      const assignee = activity.details?.assignee || "someone";
      return <><span className="text-[#0A0A0A] font-medium">{userName}</span><span className="text-[#6A7282]"> assigned {entityTitle} to {assignee}{processCtx}</span></>;
    case "sprint.created":
      return <><span className="text-[#0A0A0A] font-medium">{userName}</span><span className="text-[#6A7282]"> created sprint {entityTitle}{processCtx}</span></>;
    case "review.submitted":
      return <><span className="text-[#0A0A0A] font-medium">{userName}</span><span className="text-[#6A7282]"> submitted review for {entityTitle}{processCtx}</span></>;
    case "verification.completed":
      return <><span className="text-[#0A0A0A] font-medium">{userName}</span><span className="text-[#6A7282]"> completed verification for {entityTitle}{processCtx}</span></>;
    default:
      return <><span className="text-[#0A0A0A] font-medium">{userName}</span><span className="text-[#6A7282]"> {activity.action} {entityTitle}{processCtx}</span></>;
  }
}

function getInitials(activity: ActivityItem): string {
  const name = activity.userName || "";
  const email = activity.userEmail || "";
  if (name) {
    const parts = name.split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  if (activity.entityType === "audit_plan") return "AU";
  return "??";
}

function getAvatarColor(activity: ActivityItem): string {
  const colors = ["#10B981", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444", "#6366F1"];
  const id = activity.userId || activity.id;
  const index = parseInt(id.slice(-1), 16) % colors.length;
  return colors[index];
}

type DashboardStats = {
  processCount: number;
  openIssuesCount: number;
  upcomingAuditsCount: number;
  complianceScore: number;
};

export default function OrgDashboardPage() {
    const params = useParams();
    const orgId = params?.orgId as string;
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [activitiesLoading, setActivitiesLoading] = useState(true);
    const [upcomingAudits, setUpcomingAudits] = useState<Array<{ id: string; title: string | null; auditNumber: string | null; status: string; plannedDate: string | null }>>([]);
    const [upcomingAuditsLoading, setUpcomingAuditsLoading] = useState(true);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [statsLoading, setStatsLoading] = useState(true);
    const [lineChartData, setLineChartData] = useState<Array<{ month: string; created: number; completed: number }>>([]);
    const [pieChartData, setPieChartData] = useState<Array<{ status: string; count: number; fill: string }>>([]);
    const [chartsLoading, setChartsLoading] = useState(true);

    useEffect(() => {
        if (!orgId) return;
        apiClient
            .getDashboardStats(orgId)
            .then((res) => setStats(res))
            .catch(() => setStats(null))
            .finally(() => setStatsLoading(false));
    }, [orgId]);

    useEffect(() => {
        if (!orgId) return;
        apiClient
            .getOrganizationActivity(orgId, 20)
            .then((res) => setActivities(res.activities || []))
            .catch(() => setActivities([]))
            .finally(() => setActivitiesLoading(false));
    }, [orgId]);

    useEffect(() => {
        if (!orgId) return;
        apiClient
            .getUpcomingAuditPlans(orgId)
            .then((res) => setUpcomingAudits(res.plans || []))
            .catch(() => setUpcomingAudits([]))
            .finally(() => setUpcomingAuditsLoading(false));
    }, [orgId]);

    useEffect(() => {
        if (!orgId) return;
        apiClient
            .getDashboardCharts(orgId)
            .then((res) => {
                setLineChartData(res.lineChart || []);
                setPieChartData(res.pieChart || []);
            })
            .catch(() => {
                setLineChartData([]);
                setPieChartData([]);
            })
            .finally(() => setChartsLoading(false));
    }, [orgId]);

    return (
        <>
            {/* Top Cards */}
            <div className="dashboard-progress-cards grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* Card 1 - Active Projects */}
                <div className="flex flex-col justify-between bg-card text-[#4A5565] rounded-xl border border-[#0000001A] p-5">
                    <div className="flex justify-between items-center mb-4">
                        <p className="text-xs">Active Projects</p>
                        <ChartNoAxesCombined size={18} />
                    </div>
                    <div>
                        <span className="">{statsLoading ? "—" : (stats?.processCount ?? 0)}</span>
                        <p className="flex items-center text-sm mt-1">Across organization</p>
                    </div>
                </div>

                {/* Card 2 - Open Issues */}
                <div className="flex flex-col justify-between bg-card text-[#4A5565] rounded-xl border border-[#0000001A] p-5">
                    <div className="flex justify-between items-center mb-4">
                        <p className="text-xs">Open Issues</p>
                        <CircleAlert size={18} />
                    </div>
                    <div>
                        <span className="">{statsLoading ? "—" : (stats?.openIssuesCount ?? 0)}</span>
                        <p className="flex items-center text-sm mt-1">To do + In progress</p>
                    </div>
                </div>

                {/* Card 3 - Upcoming Audits */}
                <div className="flex flex-col justify-between bg-card text-[#4A5565] rounded-xl border border-[#0000001A] p-5">
                    <div className="flex justify-between items-center mb-4">
                        <p className="text-xs">Upcoming Audits</p>
                        <CircleCheckBig size={18} />
                    </div>
                    <div>
                        <span className="">{statsLoading ? "—" : (stats?.upcomingAuditsCount ?? 0)}</span>
                        <p className="flex items-center text-sm mt-1">In progress (pending)</p>
                    </div>
                </div>

                {/* Card 4 - Compliance Score */}
                <div className="flex flex-col justify-between bg-card text-[#4A5565] rounded-xl border border-[#0000001A] p-5">
                    <div className="flex justify-between items-center mb-4">
                        <p className="text-xs">Compliance Score</p>
                        <TrendingUp size={18} />
                    </div>
                    <div className="space-y-3">
                        <span className="text-2xl font-semibold">{statsLoading ? "—" : `${stats?.complianceScore ?? 0}%`}</span>
                        <Progress value={statsLoading ? 0 : (stats?.complianceScore ?? 0)} className="h-2" />
                    </div>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Line Chart - Issues created vs completed (last 6 months) */}
                <Card>
                    <CardHeader>
                        <CardTitle>Issues created vs completed</CardTitle>
                        <CardDescription>Last 6 months across the organization</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4">
                        {chartsLoading ? (
                            <div className="max-h-[250px] flex items-center justify-center text-sm text-muted-foreground">Loading chart…</div>
                        ) : lineChartData.length === 0 ? (
                            <div className="max-h-[250px] flex items-center justify-center text-sm text-muted-foreground">No issue data yet</div>
                        ) : (
                            <ChartContainer config={chartConfig} className="max-h-[250px] w-full">
                                <LineChart
                                    accessibilityLayer
                                    data={lineChartData}
                                    margin={{ left: 12, right: 12 }}
                                >
                                    <CartesianGrid vertical={false} />
                                    <XAxis
                                        dataKey="month"
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={8}
                                    />
                                    <ChartTooltip
                                        cursor={false}
                                        content={<ChartTooltipContent hideLabel />}
                                    />
                                    <Line
                                        dataKey="created"
                                        type="natural"
                                        stroke="var(--chart-1)"
                                        strokeWidth={2}
                                        dot={{ fill: "var(--chart-1)" }}
                                        activeDot={{ r: 6 }}
                                    />
                                    <Line
                                        dataKey="completed"
                                        type="natural"
                                        stroke="var(--chart-2)"
                                        strokeWidth={2}
                                        dot={{ fill: "var(--chart-2)" }}
                                        activeDot={{ r: 6 }}
                                    />
                                </LineChart>
                            </ChartContainer>
                        )}
                    </CardContent>
                    <CardFooter className="flex-col items-start gap-2 text-sm">
                        <div className="text-muted-foreground leading-none">
                            Organization-wide issue trend
                        </div>
                    </CardFooter>
                </Card>

                {/* Pie Chart - Issues by status */}
                <Card>
                    <CardHeader className="items-center pb-0">
                        <CardTitle>Issues by status</CardTitle>
                        <CardDescription>To do, in progress, and done</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 pb-0">
                        {chartsLoading ? (
                            <div className="max-h-[250px] flex items-center justify-center text-sm text-muted-foreground">Loading chart…</div>
                        ) : pieChartData.length === 0 || pieChartData.every((d) => d.count === 0) ? (
                            <div className="max-h-[250px] flex items-center justify-center text-sm text-muted-foreground">No issues yet</div>
                        ) : (
                            <ChartContainer
                                config={chartConfig}
                                className="mx-auto max-h-[250px] aspect-square [&_.recharts-pie-label-text]:fill-foreground"
                            >
                                <PieChart>
                                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                                    <Pie
                                        data={pieChartData}
                                        dataKey="count"
                                        nameKey="status"
                                        label
                                        outerRadius={80}
                                    >
                                        {pieChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ChartContainer>
                        )}
                    </CardContent>
                    <CardFooter className="flex-col gap-2 text-sm">
                        <div className="text-muted-foreground leading-none">
                            Distribution across organization
                        </div>
                    </CardFooter>
                </Card>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                {/* Recent Activity Card */}
                <Card>
                    <CardHeader>
                        <CardTitle>Recent Activity</CardTitle>
                        <CardDescription>Latest updates from your organization</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {activitiesLoading ? (
                            <p className="text-sm text-[#6A7282] py-4">Loading activity…</p>
                        ) : activities.length === 0 ? (
                            <p className="text-sm text-[#6A7282] py-4">No recent activity</p>
                        ) : (
                            activities.map((activity) => (
                                <ul key={activity.id} className="flex items-start gap-3">
                                    <li>
                                        <Avatar className="h-8 w-8" style={{ backgroundColor: getAvatarColor(activity) }}>
                                            <AvatarFallback className="text-white text-xs">
                                                {getInitials(activity)}
                                            </AvatarFallback>
                                        </Avatar>
                                    </li>
                                    <li className="flex flex-col min-w-0 flex-1">
                                        <p className="text-[#6A7282] text-sm">
                                            {getActivityMessage(activity)}
                                        </p>
                                        <span className="text-[#6A7282] text-xs mt-0.5">{formatTimeAgo(activity.createdAt)}</span>
                                    </li>
                                </ul>
                            ))
                        )}
                    </CardContent>
                </Card>

                {/* Upcoming Audits Card */}
                <Card>
                    <CardHeader>
                        <CardTitle>Upcoming Audits</CardTitle>
                        <CardDescription>Organization audits in progress (pending)</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {upcomingAuditsLoading ? (
                            <p className="text-sm text-[#6A7282] py-4">Loading…</p>
                        ) : upcomingAudits.length === 0 ? (
                            <p className="text-sm text-[#6A7282] py-4">No audits in progress</p>
                        ) : (
                            upcomingAudits.map((audit) => {
                                const statusLabel =
                                    audit.status === "draft"
                                        ? "Draft"
                                        : audit.status === "plan_submitted_to_auditee"
                                          ? "With auditee"
                                          : audit.status === "findings_submitted_to_auditee"
                                            ? "Findings submitted"
                                            : audit.status === "ca_submitted_to_auditor"
                                              ? "With auditor"
                                              : audit.status === "verification_ineffective"
                                                ? "Returned to auditee"
                                                : audit.status === "pending_closure"
                                                  ? "Pending closure"
                                                  : "In progress";
                                const displayTitle = audit.title?.trim() || (audit.auditNumber ? `Audit #${audit.auditNumber}` : "Audit");
                                const dateStr = audit.plannedDate
                                    ? new Date(audit.plannedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                    : "—";
                                return (
                                    <Link key={audit.id} href={`/dashboard/${orgId}/audit/create/1?auditPlanId=${audit.id}`}>
                                        <ul className="flex justify-between items-center border-b border-[#E5E7EB] py-2 hover:bg-gray-50/80 rounded-md -mx-2 px-2 transition-colors">
                                            <li className="flex flex-col min-w-0">
                                                <p className="font-medium text-[#0A0A0A] truncate">{displayTitle}</p>
                                                <span className="text-xs text-muted-foreground">{dateStr}</span>
                                            </li>
                                            <li>
                                                <span className="text-sm font-medium text-yellow-600 whitespace-nowrap">{statusLabel}</span>
                                            </li>
                                        </ul>
                                    </Link>
                                );
                            })
                        )}
                    </CardContent>
                </Card>
            </div>
            <div className="mt-5 p-5 rounded-lg bg-[#E8F1FF] border border-[#C3D9FF] flex sm:flex-row flex-col sm:items-center justify-between">
                <div className="description mb-3.5 sm:mb-0">
                    <h3 className="font-semibold text-sm mb-1">Need Help? Ask VApps AI</h3>
                    <p className="text-xs text-gray-600 leading-relaxed">
                        Get instant insights, generate reports, or find information quickly.
                    </p>
                </div>
                <Button variant="dark" size="lg" className="w-full sm:w-auto">Ask VApps AI</Button>
            </div>
        </>
    );
}