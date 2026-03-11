"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Settings,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  House,
  Plus,
  ClipboardList,
  Users,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Building2 } from 'lucide-react';
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
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
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { apiClient } from "@/lib/api-client";
import { getDashboardPath } from "@/lib/subdomain";

interface Site {
  id: string;
  name: string;
  code: string;
  location: string;
  processes: Array<{ id: string; name: string; createdAt: string }>;
}

export default function Sidebar({ orgId, slug }: { orgId: string; slug: string }) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [processOpen, setProcessOpen] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [isCreatingSite, setIsCreatingSite] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: sitesData, isLoading, refetch: fetchSites } = useQuery({
    queryKey: ["sites", orgId],
    queryFn: () => apiClient.getSites(orgId),
    staleTime: 2 * 60 * 1000,
    enabled: !!orgId,
  });

  const sites = sitesData?.sites ?? [];
  const organization = sitesData?.organization ?? null;
  const userRole = sitesData?.userRole ?? "member";

  // On subdomain use short paths (/processes); otherwise /dashboard/slug/processes
  const link = (path: string) => getDashboardPath(slug, path);

  // Sync selectedSite from query data (preserve localStorage or use first site)
  useEffect(() => {
    if (!sitesData?.sites?.length) return;
    const data = sitesData;
    let siteIdToPreserve: string | null = null;
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(`selectedSite_${orgId}`);
      if (stored) {
        try {
          siteIdToPreserve = (JSON.parse(stored) as Site).id;
        } catch {
          // ignore
        }
      }
    }
    if (siteIdToPreserve) {
      const preserved = data.sites.find((s: Site) => s.id === siteIdToPreserve);
      if (preserved) {
        setSelectedSite(preserved);
        if (typeof window !== "undefined") {
          localStorage.setItem(`selectedSite_${orgId}`, JSON.stringify(preserved));
        }
        return;
      }
    }
    const first = data.sites[0];
    setSelectedSite(first);
    if (typeof window !== "undefined") {
      localStorage.setItem(`selectedSite_${orgId}`, JSON.stringify(first));
      window.dispatchEvent(new CustomEvent("siteChanged", { detail: { siteId: first.id, orgId } }));
    }
  }, [orgId, sitesData]);

  // Listen for process creation events to refresh the sidebar
  useEffect(() => {
    const handleProcessCreated = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail.orgId === orgId) {
        const siteIdToPreserve = customEvent.detail.siteId;
        if (siteIdToPreserve && typeof window !== "undefined") {
          const storedSite = localStorage.getItem(`selectedSite_${orgId}`);
          if (storedSite) {
            try {
              const parsedSite = JSON.parse(storedSite);
              if (parsedSite.id !== siteIdToPreserve) {
                const siteToStore = { ...parsedSite, id: siteIdToPreserve };
                localStorage.setItem(`selectedSite_${orgId}`, JSON.stringify(siteToStore));
              }
            } catch {
              // ignore
            }
          }
        }
        queryClient.invalidateQueries({ queryKey: ["sites", orgId] });
      }
    };

    const handleProcessDeleted = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail.orgId === orgId) {
        queryClient.invalidateQueries({ queryKey: ["sites", orgId] });
      }
    };

    window.addEventListener("processCreated", handleProcessCreated);
    window.addEventListener("processDeleted", handleProcessDeleted);
    return () => {
      window.removeEventListener("processCreated", handleProcessCreated);
      window.removeEventListener("processDeleted", handleProcessDeleted);
    };
  }, [orgId, queryClient]);

  const handleSiteChange = (site: Site) => {
    setSelectedSite(site);
    setDropdownOpen(false);
    // Store selected site in localStorage so other components can access it
    if (typeof window !== 'undefined') {
      localStorage.setItem(`selectedSite_${orgId}`, JSON.stringify(site));
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('siteChanged', { detail: { siteId: site.id, orgId } }));
    }
  };

  const handleCreateSite = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsCreatingSite(true);

    // Store form reference before async operations
    const form = e.currentTarget;
    const formData = new FormData(form);
    const siteName = (formData.get("siteName") as string)?.trim();
    const location = (formData.get("location") as string)?.trim();

    // Validate required fields
    if (!siteName || siteName.length === 0) {
      alert("Site name is required");
      setIsCreatingSite(false);
      return;
    }

    if (!location || location.length === 0) {
      alert("Location is required");
      setIsCreatingSite(false);
      return;
    }

    try {
      const data = await apiClient.createSite(orgId, {
        siteName,
        location,
      });

      const newSite: Site = {
        id: data.site.id,
        name: data.site.name,
        code: data.site.code,
        location: data.site.location,
        processes: data.site.processes || [],
      };

      setSelectedSite(newSite);
      if (typeof window !== "undefined") {
        localStorage.setItem(`selectedSite_${orgId}`, JSON.stringify(newSite));
        window.dispatchEvent(new CustomEvent("siteChanged", { detail: { siteId: newSite.id, orgId } }));
      }

      if (form) form.reset();
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["sites", orgId] });
    } catch (error: any) {
      console.error("Error creating site:", error);
      const errorMessage = error.response?.data?.error || error.message || "Failed to create site";
      alert(errorMessage);
    } finally {
      setIsCreatingSite(false);
    }
  };

  return (
    <aside className="hidden md:flex flex-col w-[20%] bg-white h-[90vh]">

      <div className="border-b pb-3 p-5">
        <Image className="mb-3" src="/images/logo.png" alt="Vercel Logo" width={95} height={40} />

        <div className="relative">
          {isLoading ? (
            <div className="flex gap-2 items-center p-3 border border-[#0000001A] rounded-[12px]">
              <Building2 size={18} />
              <div className="flex flex-col gap-1.5">
                <p className="text-xs text-gray-500">Loading...</p>
              </div>
            </div>
          ) : (
            <>
              <div
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex gap-2 items-center p-3 border border-[#0000001A] rounded-[12px] cursor-pointer"
              >
                <Building2 size={18} />
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-xs">{selectedSite?.location || organization?.name || "No site selected"}</h3>
                  <p className="text-xs">{selectedSite?.name || organization?.name || ""}</p>
                </div>
                <ChevronDown size={18} className="ml-auto" />
              </div>

              {dropdownOpen && (
                <div className="absolute left-0 mt-2 w-full bg-white border border-[#0000001A] rounded-[12px] shadow-lg z-10 max-h-96 overflow-y-auto">
                  <div className="py-2">
                    {sites.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-gray-500 text-center">
                        No sites available
                      </div>
                    ) : (
                      sites.map((site) => (
                        <div
                          key={site.id}
                          onClick={() => handleSiteChange(site)}
                          className={`px-3 py-2 cursor-pointer hover:bg-gray-100 ${selectedSite?.id === site.id ? "bg-gray-50" : ""
                            }`}
                        >
                          <h3 className="text-xs font-medium">{site.location}</h3>
                          <p className="text-xs">{site.name} ({site.code})</p>
                        </div>
                      ))
                    )}
                  </div>

                  {userRole === "owner" && (
                    <div className="add-btn border-t">
                      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                          <Button
                            type="button"
                            className="bg-[#F4F4F4] text-[#0A0A0A] text-xs p-3 w-full rounded-none rounded-b-[12px] justify-start"
                          >
                            <Plus size={18} />
                            Add New Site
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                          <form onSubmit={handleCreateSite}>
                            <DialogHeader>
                              <DialogTitle>Add New Site</DialogTitle>
                              <DialogDescription>
                                Create a new site within your organization.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                              <div className="grid gap-3">
                                <Label htmlFor="site-name">Site Name *</Label>
                                <Input
                                  id="site-name"
                                  name="siteName"
                                  placeholder="e.g., Dubai Office"
                                  required
                                  disabled={isCreatingSite}
                                />
                              </div>
                              <div className="grid gap-3">
                                <Label htmlFor="location">Location *</Label>
                                <Input
                                  id="location"
                                  name="location"
                                  placeholder="e.g., Dubai, UAE"
                                  required
                                  disabled={isCreatingSite}
                                />
                              </div>
                              <div className="grid gap-3">
                                <p className="text-xs text-gray-500">
                                  Site code will be auto-generated (S001, S002, etc.)
                                </p>
                              </div>
                            </div>
                            <DialogFooter>
                              <DialogClose asChild>
                                <Button type="button" variant="outline" disabled={isCreatingSite}>
                                  Cancel
                                </Button>
                              </DialogClose>
                              <Button type="submit" disabled={isCreatingSite}>
                                {isCreatingSite ? "Creating..." : "Create Site"}
                              </Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <nav className="flex-1 p-5 space-y-1">
        <Link href={link("")} className={`flex items-center gap-3 px-3 py-2 text-sm transition border-b pb-5 mb-2 ${pathname === "/" || pathname.includes(`/${slug}`) ? "text-[text-[#364153]" : "text-black"}`} >
          <House size={18} />
          Dashboard
        </Link>

        <div
          className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition
    ${pathname.includes("/processes") ? "bg-[#EEFFF3]" : "hover:bg-gray-50"}
  `}
        >
          <Link
            href={link("processes")}
            className={`flex items-center gap-3
      ${pathname.includes("/processes") ? "font-medium text-[#22B323]" : "text-gray-600"}
    `}
          >
            <FolderKanban size={18} />
            Processes
          </Link>

          <button onClick={() => setProcessOpen((prev) => !prev)}>
            {processOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </div>

        <Collapsible open={processOpen} onOpenChange={setProcessOpen}>
          <CollapsibleContent className="pt-1 pl-2 space-y-1">
            {selectedSite && selectedSite.processes.length > 0 ? (
              selectedSite.processes.map((process) => {
                // Create a URL-friendly slug from process name
                const processSlug = process.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                const processHref = `processes/${process.id}`;

                return (
                  <Link
                    key={process.id}
                    href={link(processHref)}
                    className={`block px-3 py-2 text-sm rounded-lg transition
                      ${pathname.includes(processHref)
                        ? "bg-gray-100 font-medium text-gray-900"
                        : "text-gray-600 hover:bg-gray-50"
                      }
                    `}
                  >
                    {process.name}
                  </Link>
                );
              })
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500">
                {selectedSite ? "No processes available" : "Select a site to view processes"}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
        <div className="">
          <Link
            href={link("audit")}
            className={`flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition
              ${pathname.includes("/audit")
                ? "bg-gray-100 font-medium text-gray-900"
                : "text-gray-600 hover:bg-gray-50"
              }
            `}
          >
            <ClipboardList size={18} />
            Audit
          </Link>
        </div>
        <div className="">
          <Link
            href={link("settings/teams")}
            className={`flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition
              ${pathname.includes("/settings/teams")
                ? "bg-gray-100 font-medium text-gray-900"
                : "text-gray-600 hover:bg-gray-50"
              }
            `}
          >
            <Users size={18} />
            Teams
          </Link>
        </div>
      </nav>
      <div className="footer p-5">
        <Link
          href={link("settings")}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition mb-3
          ${pathname.includes("settings")
              ? "bg-gray-100 font-medium text-gray-900"
              : "text-gray-600 hover:bg-gray-50"
            }`}
        >
          <Settings size={18} />
          Settings
        </Link>

        <div className="flex py-3 items-center">

          <Avatar className="mr-2">
            <AvatarImage src="https://github.com/shadcn.png" alt="Company Image" />
            <AvatarFallback>SS</AvatarFallback>
          </Avatar>
          <div className="description">
            <h3 className="text-sm">{organization?.name || "Organization"}</h3>
            <p className="text-xs">Free</p>
          </div>
          <Link href="/upgrade" className="text-xs text-[#22B323] border border-[#22B32366] rounded-full bg-[#EEFFF3] p-2.5 ml-auto">Upgrade</Link>
        </div>
      </div>
    </aside>
  );
}