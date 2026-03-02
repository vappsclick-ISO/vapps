"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { MapPin, Building2, Users, ChevronRight, Edit, Trash2, Plus, FolderKanban } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

type Site = {
  id: string;
  name: string;
  code: string;
  location: string;
  createdAt: string;
  updatedAt: string;
  processes: Array<{
    id: string;
    name: string;
    createdAt: string;
  }>;
};

export default function SitesDepartmentsPage() {
  const params = useParams();
  const orgId = params?.orgId as string;

  const [isLoading, setIsLoading] = useState(true);
  const [sites, setSites] = useState<Site[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [expandedSites, setExpandedSites] = useState<string[]>([]);
  const [canManageSites, setCanManageSites] = useState(false);

  // Form state for add/edit
  const [formData, setFormData] = useState({
    siteName: "",
    location: "",
  });

  const fetchSites = useCallback(async () => {
    if (!orgId) {
      console.warn("orgId is not available yet");
      return;
    }
    try {
      setIsLoading(true);
      const response = await apiClient.getSites(orgId);
      setSites(response.sites || []);
      setLastUpdated(new Date().toISOString());
    } catch (error: any) {
      console.error("Error fetching sites:", error);
      toast.error("Failed to load sites");
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (orgId && typeof orgId === 'string' && orgId !== 'undefined') {
      fetchSites();
      fetchPermissions();
    }
  }, [orgId, fetchSites]);

  const fetchPermissions = useCallback(async () => {
    if (!orgId) return;
    try {
      const res = await apiClient.get<{
        currentUserPermissions: {
          manage_sites: boolean;
        };
      }>(`/organization/${orgId}/permissions`);
      setCanManageSites(res.currentUserPermissions?.manage_sites ?? false);
    } catch (e: any) {
      console.error("Failed to fetch permissions:", e);
      setCanManageSites(false);
    }
  }, [orgId]);

  const handleAddSite = async () => {
    if (!formData.siteName.trim() || !formData.location.trim()) {
      toast.error("Site name and location are required");
      return;
    }

    try {
      await apiClient.createSite(orgId, {
        siteName: formData.siteName.trim(),
        location: formData.location.trim(),
      });
      toast.success("Site created successfully");
      setIsAddDialogOpen(false);
      setFormData({ siteName: "", location: "" });
      fetchSites();
    } catch (error: any) {
      console.error("Error creating site:", error);
      toast.error(error.message || "Failed to create site");
    }
  };

  const handleEditSite = (site: Site) => {
    setEditingSite(site);
    setFormData({
      siteName: site.name,
      location: site.location,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateSite = async () => {
    if (!editingSite || !formData.siteName.trim() || !formData.location.trim()) {
      toast.error("Site name and location are required");
      return;
    }

    try {
      await apiClient.updateSite(orgId, editingSite.id, {
        siteName: formData.siteName.trim(),
        location: formData.location.trim(),
      });
      toast.success("Site updated successfully");
      setIsEditDialogOpen(false);
      setEditingSite(null);
      setFormData({ siteName: "", location: "" });
      fetchSites();
    } catch (error: any) {
      console.error("Error updating site:", error);
      toast.error(error.message || "Failed to update site");
    }
  };

  const handleDeleteSite = async (site: Site) => {
    if (!confirm(`Are you sure you want to delete "${site.name}"? This will also delete all associated processes.`)) {
      return;
    }

    try {
      await apiClient.deleteSite(orgId, site.id);
      toast.success("Site deleted successfully");
      fetchSites();
    } catch (error: any) {
      console.error("Error deleting site:", error);
      toast.error(error.message || "Failed to delete site");
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // Calculate statistics from actual data
  const totalSites = sites.length;
  const totalProcesses = sites.reduce((sum, site) => sum + site.processes.length, 0);
  const headquartersCount = sites.filter((site) => 
    site.name.toLowerCase().includes("headquarters") || 
    site.name.toLowerCase().includes("hq")
  ).length;

  // Note: Employee count and departments are not in the database yet
  // Only show stats that exist in the database
  const stats = [
    { title: "Total Sites", value: totalSites },
    { title: "Total Processes", value: totalProcesses },
    ...(headquartersCount > 0 ? [{ title: "Headquarters", value: headquartersCount }] : []),
  ];

  // Don't render if orgId is not available
  if (!orgId || orgId === 'undefined') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading organization...</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-500 mb-1">
            Settings &gt; Sites & Departments
          </div>
          <h1 className="text-2xl font-semibold">Sites & Departments</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your locations and organizational structure.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <span className="text-sm text-gray-500">
              Last updated: {formatDate(lastUpdated)}
            </span>
          )}
          {canManageSites && (
            <Button onClick={() => setIsAddDialogOpen(true)} variant="dark">
              <Plus className="h-4 w-4 mr-2" />
              Add Site
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <Card key={idx}>
            <CardContent className="p-6">
              <p className="text-sm text-gray-500 mb-2">{stat.title}</p>
              <p className="text-3xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* All Sites Section */}
      <Card>
        <CardHeader>
          <CardTitle>All Sites</CardTitle>
          <CardDescription>
            Hierarchical view of your organization's locations and departments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sites.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No sites yet</p>
              <Button onClick={() => setIsAddDialogOpen(true)} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Site
              </Button>
            </div>
          ) : (
            <Accordion
              type="multiple"
              value={expandedSites}
              onValueChange={(values: string[]) => setExpandedSites(values)}
              className="space-y-2"
            >
              {sites.map((site) => (
                <AccordionItem
                  key={site.id}
                  value={site.id}
                  className="border rounded-lg px-4"
                >
                  <div className="flex items-center justify-between w-full pr-4 py-4">
                    <AccordionTrigger className="hover:no-underline py-0 flex-1 flex items-center gap-3 group">
                      <span className="inline-block transition-transform group-data-[state=open]:rotate-90">
                        <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                      </span>
                      <Building2 className="h-5 w-5 text-gray-400 shrink-0" />
                      <div className="text-left flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{site.name}</span>
                          <Badge
                            variant="secondary"
                            className={
                              site.name.toLowerCase().includes("headquarters") ||
                              site.name.toLowerCase().includes("hq")
                                ? "bg-purple-100 text-purple-700"
                                : "bg-blue-100 text-blue-700"
                            }
                          >
                            {site.name.toLowerCase().includes("headquarters") ||
                            site.name.toLowerCase().includes("hq")
                              ? "headquarters"
                              : "office"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            <span>{site.location}</span>
                          </div>
                          {site.processes.length > 0 && (
                            <div className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              <span>{site.processes.length} processes</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </AccordionTrigger>
                    {canManageSites && (
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditSite(site)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSite(site)}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <AccordionContent>
                    <div className="pt-4 pb-2 pl-8">
                      {site.processes.length === 0 ? (
                        <p className="text-sm text-gray-500">No processes for this site</p>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-gray-700 mb-3">
                            Processes ({site.processes.length})
                          </p>
                          <div className="space-y-2">
                            {site.processes.map((process) => (
                              <div
                                key={process.id}
                                className="flex items-center gap-2 p-2 rounded bg-gray-50 hover:bg-gray-100"
                              >
                                <FolderKanban className="h-4 w-4 text-gray-400" />
                                <span className="text-sm">{process.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Add Site Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Site</DialogTitle>
            <DialogDescription>
              Create a new site location for your organization.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="siteName">
                Site Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="siteName"
                value={formData.siteName}
                onChange={(e) =>
                  setFormData({ ...formData, siteName: e.target.value })
                }
                placeholder="San Francisco HQ"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">
                Location <span className="text-red-500">*</span>
              </Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                placeholder="123 Business Street, San Francisco, CA 94102"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false);
                setFormData({ siteName: "", location: "" });
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAddSite} variant="dark">
              Add Site
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Site Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Site</DialogTitle>
            <DialogDescription>
              Update site information.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editSiteName">
                Site Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="editSiteName"
                value={formData.siteName}
                onChange={(e) =>
                  setFormData({ ...formData, siteName: e.target.value })
                }
                placeholder="San Francisco HQ"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editLocation">
                Location <span className="text-red-500">*</span>
              </Label>
              <Input
                id="editLocation"
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                placeholder="123 Business Street, San Francisco, CA 94102"
              />
            </div>
            {editingSite && (
              <div className="text-sm text-gray-500">
                <p>Site Code: <span className="font-mono">{editingSite.code}</span></p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                setEditingSite(null);
                setFormData({ siteName: "", location: "" });
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateSite} variant="dark">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
