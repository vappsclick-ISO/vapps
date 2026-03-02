"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  extendedProps?: { issueId: string };
};

const Calendar = () => {
  const params = useParams();
  const orgId = params.orgId as string;
  const processId = params.processId as string;

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchIssues = async () => {
      if (!orgId || !processId) return;
      try {
        setIsLoading(true);
        const res = await apiClient.getIssues(orgId, processId);
        const issues = res.issues ?? [];
        const mapped: CalendarEvent[] = issues.map((issue: any) => {
          const dateStr = issue.updatedAt || issue.createdAt || new Date().toISOString();
          const d = new Date(dateStr);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          const dateOnly = `${y}-${m}-${day}`;
          return {
            id: issue.id,
            title: issue.title || "Untitled",
            start: dateOnly,
            extendedProps: { issueId: issue.id },
          };
        });
        setEvents(mapped);
      } catch (err: any) {
        console.error("Error fetching issues for calendar:", err);
        toast.error("Failed to load issues");
        setEvents([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchIssues();
  }, [orgId, processId]);

  const handleEventClick = (info: any) => {
    const issueId = info.event.id ?? info.event.extendedProps?.issueId;
    if (!issueId || typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("openIssueDialog", {
        detail: { issueId, orgId, processId },
      })
    );
  };

  return (
    <>
      <div className="p-4 bg-white rounded-lg shadow-md [&_.fc-event]:cursor-pointer [&_.fc-daygrid-event]:cursor-pointer">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            Loading calendar...
          </div>
        ) : (
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            events={events}
            eventClick={handleEventClick}
            height="auto"
          />
        )}
      </div>
    </>
  );
};

export default Calendar;
