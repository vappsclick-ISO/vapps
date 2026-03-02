"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Custom target icon with concentric rings
const TargetIcon = () => (
  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="w-6 h-6 text-blue-600"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  </div>
);

interface KPI {
  id: string;
  name: string;
  target: string;
  current: string;
  status: "on-track" | "at-risk";
}

interface Widget {
  id: string;
  name: string;
  selected: boolean;
}

export default function KPIReportsPage() {
  const [kpis] = useState<KPI[]>([
    {
      id: "issue-resolution",
      name: "Issue Resolution Time",
      target: "< 48 hours",
      current: "36 hours",
      status: "on-track",
    },
    {
      id: "customer-satisfaction",
      name: "Customer Satisfaction",
      target: "> 90%",
      current: "92%",
      status: "on-track",
    },
    {
      id: "audit-completion",
      name: "Audit Completion Rate",
      target: "100%",
      current: "85%",
      status: "at-risk",
    },
    {
      id: "document-compliance",
      name: "Document Compliance",
      target: "> 95%",
      current: "98%",
      status: "on-track",
    },
  ]);

  const [widgets, setWidgets] = useState<Widget[]>([
    { id: "issue-status", name: "Issue Status Overview", selected: true },
    { id: "audit-progress", name: "Audit Progress", selected: false },
    { id: "team-performance", name: "Team Performance", selected: true },
    { id: "document-status", name: "Document Status", selected: false },
    { id: "compliance-score", name: "Compliance Score", selected: true },
    { id: "recent-activity", name: "Recent Activity", selected: false },
  ]);

  const handleWidgetToggle = (widgetId: string) => {
    setWidgets((prev) =>
      prev.map((widget) =>
        widget.id === widgetId ? { ...widget, selected: !widget.selected } : widget
      )
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header Section */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-gray-500 mb-1">Settings &gt; KPI & Reports</div>
          <h1 className="text-2xl font-semibold">KPI & Reports Configuration</h1>
          <p className="text-sm text-gray-500 mt-1">
            Customize key performance indicators and dashboard metrics.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500">
            Last updated: November 11, 2025 at 1:30 PM
          </div>
          <Button variant="default" className="bg-gray-900 hover:bg-gray-800">
            Edit KPIs
          </Button>
        </div>
      </div>

      {/* Key Performance Indicators Section */}
      <Card>
        <CardHeader>
          <CardTitle>Key Performance Indicators</CardTitle>
          <CardDescription>Set targets and thresholds for your metrics.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {kpis.map((kpi) => (
            <div
              key={kpi.id}
              className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100"
            >
              <TargetIcon />
              <div className="flex-1">
                <div className="font-semibold text-gray-900 mb-1">{kpi.name}</div>
                <div className="text-sm text-gray-600">
                  Target: {kpi.target} • Current: {kpi.current}
                </div>
              </div>
              <Badge
                className={
                  kpi.status === "on-track"
                    ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-100"
                    : "bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100"
                }
              >
                {kpi.status === "on-track" ? "On Track" : "At Risk"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Dashboard Widgets Section */}
      <Card>
        <CardHeader>
          <CardTitle>Dashboard Widgets</CardTitle>
          <CardDescription>
            Configure which charts and widgets appear on the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {widgets.map((widget) => (
              <Button
                key={widget.id}
                variant="outline"
                onClick={() => handleWidgetToggle(widget.id)}
                className={`h-auto p-4 justify-start ${
                  widget.selected
                    ? "bg-primary text-white border-primary-900 hover:bg-primary-800"
                    : "bg-white hover:bg-gray-50"
                }`}
              >
                {widget.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
