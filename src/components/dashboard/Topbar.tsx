"use client";

import { Search, Bell, Check, Moon, Globe, User, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { apiClient } from "@/lib/api-client";
import { getDashboardPath } from "@/lib/subdomain";

import { Field, FieldGroup } from "@/components/ui/field"
import { Label } from "@/components/ui/label"

import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"



type NotificationActivity = {
    id: string;
    userName: string;
    userEmail: string | null;
    action: string;
    entityType: string;
    entityId?: string;
    entityTitle?: string;
    details: Record<string, unknown>;
    createdAt: string;
    processId: string | null;
};

function formatNotificationMessage(a: NotificationActivity): string {
    const userName = a.userName || a.userEmail || "Someone";
    const entityTitle = a.entityTitle || a.entityId || "item";

    if (a.entityType === "audit_plan") {
        const statusLabel = (a.details?.statusLabel as string) || (a.details?.status as string) || "updated";
        return `Audit plan ${entityTitle}: ${statusLabel}`;
    }

    switch (a.action) {
        case "issue.created":
            return `${userName} created issue ${entityTitle}`;
        case "issue.updated":
            return `${userName} updated issue ${entityTitle}`;
        case "issue.status_changed":
            const newStatus = (a.details?.newStatus as string) || "updated";
            return `${userName} changed status of ${entityTitle} to ${newStatus}`;
        case "issue.assigned":
            const assignee = (a.details?.assignee as string) || "someone";
            return `${userName} assigned ${entityTitle} to ${assignee}`;
        case "sprint.created":
            return `${userName} created sprint ${entityTitle}`;
        case "review.submitted":
            return `${userName} submitted review for ${entityTitle}`;
        case "verification.completed":
            return `${userName} completed verification for ${entityTitle}`;
        default:
            return `${userName} ${a.action} ${entityTitle}`;
    }
}

function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
    return date.toLocaleDateString();
}

/** Build href for notification so clicking navigates to the relevant screen. */
function getNotificationHref(slug: string | undefined, a: NotificationActivity): string | null {
    if (!slug) return null;
    if (a.entityType === "audit_plan" && a.entityId) {
        const base = getDashboardPath(slug, "audit/create/1");
        return `${base}?auditPlanId=${encodeURIComponent(a.entityId)}`;
    }
    if (a.processId) {
        const action = (a.action || "").toLowerCase();
        if (action.includes("issue")) return getDashboardPath(slug, `processes/${a.processId}/issues`);
        if (action.includes("sprint")) return getDashboardPath(slug, `processes/${a.processId}/backlog`);
        if (action.includes("review") || action.includes("verification")) return getDashboardPath(slug, `processes/${a.processId}/timeline`);
        return getDashboardPath(slug, `processes/${a.processId}`);
    }
    return null;
}

export default function Topbar() {
    const params = useParams();
    const orgId = params?.orgId as string | undefined;
    const [selectedLang, setSelectedLang] = useState("English");
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
    const [dismissing, setDismissing] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);

    const { data: notifData, isLoading: notificationsLoading } = useQuery({
        queryKey: ["notifications", orgId],
        queryFn: () => apiClient.getNotifications(orgId!, 25),
        enabled: !!orgId,
        staleTime: 60 * 1000,
    });

    const notifications = notifData?.activities ?? [];
    useEffect(() => {
        if (notifData?.dismissedIds) setDismissedIds(new Set(notifData.dismissedIds));
    }, [notifData?.dismissedIds]);

    const visibleNotifications = notifications.filter((n) => !dismissedIds.has(n.id));
    const notificationCount = visibleNotifications.length;

    const handleDismissOne = async (id: string) => {
        if (!orgId) return;
        setDismissedIds((prev) => new Set([...prev, id]));
        try {
            await apiClient.dismissNotifications(orgId, [id]);
        } catch {
            setDismissedIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };

    const handleClearAll = async () => {
        if (!orgId || visibleNotifications.length === 0) return;
        const ids = visibleNotifications.map((n) => n.id);
        setDismissedIds((prev) => new Set([...prev, ...ids]));
        setDismissing(true);
        try {
            await apiClient.dismissNotifications(orgId, ids);
        } catch {
            setDismissedIds((prev) => {
                const next = new Set(prev);
                ids.forEach((id) => next.delete(id));
                return next;
            });
        } finally {
            setDismissing(false);
        }
    };

    const handleLogout = async () => {
        await signOut({ callbackUrl: "/auth" });
    };

    return (
        <header className="h-14 border-b bg-[#FCFCFC] px-4 flex items-center justify-between gap-3">
            {/* Center - Search */}
            <div className="flex-1 flex">
                <div className="relative w-full max-w-md">
                    <div className="md:block hidden">
                        <Search size={18} className="absolute top-[50%] transform -translate-y-1/2 left-3 text-gray-500" />
                        <Input
                            className="pl-10 border-none bg-[#F3F3F5]"
                            placeholder="Search tasks, docs, processes..."
                        />
                    </div>
                    <div className="md:hidden block bg-[#F3F3F5] p-4 rounded-lg w-5 h-5">
                        <Dialog>
                            <form>
                                <DialogTrigger asChild>
                                    <Search size={18} className="absolute top-[50%] transform -translate-y-1/2 left-2 text-gray-500" />
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-sm">
                                    <DialogHeader>
                                        <DialogTitle>Edit profile</DialogTitle>
                                        <DialogDescription>
                                            Make changes to your profile here. Click save when you&apos;re
                                            done.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <FieldGroup>
                                        <Field>
                                            <Label htmlFor="search-1">Search</Label>
                                            <Input id="search-1" name="search" defaultValue="Pedro Duarte" />
                                        </Field>
                                    </FieldGroup>
                                    <DialogFooter>
                                        <DialogClose asChild>
                                            <Button variant="outline">Cancel</Button>
                                        </DialogClose>
                                        <Button type="submit">Search</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </form>
                        </Dialog>
                    </div>
                </div>

            </div>

            {/* Right */}
            <div className="flex items-center gap-3">
                <Button variant="outline">Ask AI Assistant</Button>

                {/* Notification Popover */}
                <Popover open={notifOpen} onOpenChange={setNotifOpen}>
                    <PopoverTrigger className="relative p-2 rounded-full hover:bg-accent">
                        <Bell className="h-5 w-5" />

                        {notificationCount > 0 && (
                            <span
                                className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-black text-white text-[10px] font-medium leading-none"
                            >
                                {notificationCount}
                            </span>
                        )}
                    </PopoverTrigger>

                    <PopoverContent className="w-100 p-4 -translate-x-30 border border-[#0000001A] shadow-lg max-h-[min(24rem,70vh)] overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-base">Notifications</h4>
                            {!notificationsLoading && visibleNotifications.length > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs text-[#6A7282] h-7 px-2"
                                    onClick={handleClearAll}
                                    disabled={dismissing}
                                >
                                    {dismissing ? "Clearing…" : "Clear all"}
                                </Button>
                            )}
                        </div>
                        <div className="space-y-2 overflow-y-auto flex-1 min-h-0">
                            {notificationsLoading ? (
                                <p className="text-sm text-[#6A7282] py-4">Loading…</p>
                            ) : visibleNotifications.length === 0 ? (
                                <p className="text-sm text-[#6A7282] py-4">No recent activity</p>
                            ) : (
                                visibleNotifications.map((a) => {
                                    const href = getNotificationHref(orgId, a);
                                    const content = (
                                        <>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 text-[#6A7282] hover:text-[#0A0A0A] z-10"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleDismissOne(a.id);
                                                }}
                                                aria-label="Remove notification"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </Button>
                                            <p className="text-[#0A0A0A] text-sm pr-6">{formatNotificationMessage(a)}</p>
                                            <span className="text-xs text-[#6A7282]">{formatRelativeTime(a.createdAt)}</span>
                                        </>
                                    );
                                    return href ? (
                                        <Link
                                            key={a.id}
                                            href={href}
                                            className="flex flex-col gap-1.5 p-4 rounded-xl bg-[#F9FAFB] group relative pr-9 hover:bg-[#F3F4F6] transition-colors cursor-pointer"
                                            onClick={() => setNotifOpen(false)}
                                        >
                                            {content}
                                        </Link>
                                    ) : (
                                        <div
                                            key={a.id}
                                            className="p-4 rounded-xl flex flex-col gap-1.5 bg-[#F9FAFB] group relative pr-9"
                                        >
                                            {content}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </PopoverContent>
                </Popover>

                {/* Language Selector */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="relative hover:bg-accent">
                            <Globe size={20} />
                        </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent
                        align="end"
                        className="w-44 rounded-lg shadow-md border bg-white"
                    >

                        {["English", "Spanish", "French", "German", "Hindi"].map((lang) => (
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



                <Button variant="ghost" size="icon">
                    <Moon size={20} />
                </Button>

                {/* User Menu */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8 flex items-center justify-center"
                        >
                            <User className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end" className="w-48 p-1">

                        <DropdownMenuItem asChild>
                            <Link href={orgId ? getDashboardPath(orgId, "account") : "#"}>
                                Account Settings
                            </Link>
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                            className="text-red-600 font-medium"
                            onSelect={(e) => {
                                e.preventDefault();
                                handleLogout();
                            }}
                        >
                            Logout
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

            </div>
        </header>
    );
}