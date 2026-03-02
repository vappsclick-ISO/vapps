"use client";
import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Info, Save } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { Calendar } from "@/components/ui/calendar";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";


import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


export default function OrganizationProfilePage() {
  const params = useParams();
  const orgId = params?.orgId as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    legalName: "",
    registrationId: "",
    taxId: "",
    industry: "",
    companySize: "",
    foundedDate: "",
    website: "",
    primaryEmail: "",
    supportEmail: "",
    phone: "",
    fax: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
    brandColor: "#05EE07",
    brandFont: "Arial",
  });

  useEffect(() => {
    if (orgId && typeof orgId === 'string' && orgId !== 'undefined') {
      fetchOrganizationInfo();
    }
  }, [orgId]);

  const fetchOrganizationInfo = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.getOrganizationInfo(orgId);
      if (response.organizationInfo) {
        const info = response.organizationInfo;
        setFormData({
          name: info.name || "",
          legalName: info.legalName || "",
          registrationId: info.registrationId || "",
          taxId: info.taxId || "",
          industry: info.industry || "",
          companySize: info.companySize || "",
          foundedDate: info.foundedDate || "",
          website: info.website || "",
          primaryEmail: info.contactEmail || "",
          supportEmail: info.supportEmail || "",
          phone: info.phone || "",
          fax: info.fax || "",
          addressLine1: info.address?.split('\n')[0] || "",
          addressLine2: info.address?.split('\n')[1] || "",
          city: "",
          state: "",
          zipCode: "",
          country: "",
          brandColor: info.brandColor || "#05EE07",
          brandFont: info.brandFont || "Arial",
        });
        setLastUpdated(info.updatedAt);
      }
    } catch (error: any) {
      console.error("Error fetching organization info:", error);
      toast.error("Failed to load organization profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const address = [formData.addressLine1, formData.addressLine2]
        .filter(Boolean)
        .join('\n');

      await apiClient.updateOrganizationInfo(orgId, {
        name: formData.name,
        legalName: formData.legalName,
        registrationId: formData.registrationId,
        taxId: formData.taxId,
        industry: formData.industry,
        companySize: formData.companySize,
        foundedDate: formData.foundedDate,
        website: formData.website,
        primaryEmail: formData.primaryEmail,
        supportEmail: formData.supportEmail,
        phone: formData.phone,
        fax: formData.fax,
        address: address || undefined,
        contactName: formData.primaryEmail ? "Primary Contact" : undefined,
        contactEmail: formData.primaryEmail || undefined,
      });

      toast.success("Organization profile updated successfully");
      setIsEditing(false);
      fetchOrganizationInfo();
    } catch (error: any) {
      console.error("Error saving organization info:", error);
      toast.error(error.message || "Failed to update organization profile");
    } finally {
      setIsSaving(false);
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

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };


  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-500 mb-1">
            Settings &gt; Organization Profile
          </div>
          <h1 className="text-2xl font-semibold">Organization Profile</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your company information and branding.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <span className="text-sm text-gray-500">
              Last updated: {formatDate(lastUpdated)}
            </span>
          )}
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)} variant="dark">
              Edit Profile
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  fetchOrganizationInfo();
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving} variant="dark">
              <Save className="size-4 mr-2" />
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Branding Card */}
      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
          <CardDescription>Your company logo and visual identity.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Company Logo */}
          <div className="space-y-2">
            <Label>Company Logo</Label>

            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                {logoPreview ? (
                  <AvatarImage src={logoPreview} alt="Company Logo" />
                ) : (
                  <AvatarFallback className="bg-gray-800 text-white text-xl">
                    {formData.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                )}
              </Avatar>

              {isEditing && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Upload Logo
                  </Button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                </>
              )}
            </div>
          </div>


          {/* Primary Brand Color */}
          <div className="space-y-2">
            <Label>Primary Brand Color</Label>
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded border border-gray-300"
                style={{ backgroundColor: formData.brandColor }}
              />
              {isEditing ? (
                <Input
                  type="color"
                  value={formData.brandColor}
                  onChange={(e) =>
                    setFormData({ ...formData, brandColor: e.target.value })
                  }
                  className="w-32"
                />
              ) : (
                <Input value={formData.brandColor} disabled className="w-32" />
              )}
            </div>
          </div>

          {/* Brand Font */}
          <div className="space-y-2">
            <Label>Brand Font</Label>

            {isEditing ? (
              <Select
                value={formData.brandFont}
                onValueChange={(value) =>
                  setFormData({ ...formData, brandFont: value })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select font" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="Arial">Arial</SelectItem>
                  <SelectItem value="Helvetica">Helvetica</SelectItem>
                  <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                  <SelectItem value="Georgia">Georgia</SelectItem>
                  <SelectItem value="Roboto">Roboto</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Input value={formData.brandFont || ""} disabled />
            )}
          </div>

        </CardContent>
      </Card>

      {/* Company Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>Company Details</CardTitle>
          <CardDescription>Legal and business information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                Company Name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                disabled={!isEditing}
                placeholder="Acme Corporation"
              />
            </div>
            <div className="space-y-2">
              <Label>Legal Name</Label>
              <Input
                value={formData.legalName}
                onChange={(e) =>
                  setFormData({ ...formData, legalName: e.target.value })
                }
                disabled={!isEditing}
                placeholder="Acme Corporation Inc."
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                Registration Number
                <Info size={16} />
              </Label>
              <Input
                value={formData.registrationId}
                onChange={(e) =>
                  setFormData({ ...formData, registrationId: e.target.value })
                }
                disabled={!isEditing}
                placeholder="REG-2024-001"
              />
            </div>
            <div className="space-y-2">
              <Label>Tax ID / EIN</Label>
              <Input
                value={formData.taxId}
                onChange={(e) =>
                  setFormData({ ...formData, taxId: e.target.value })
                }
                disabled={!isEditing}
                placeholder="12-3456789"
              />
            </div>
            <div className="space-y-2">
              <Label>Industry</Label>

              {isEditing ? (
                <Select
                  value={formData.industry}
                  onValueChange={(value) =>
                    setFormData({ ...formData, industry: value })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="Technology & Software">
                      Technology & Software
                    </SelectItem>
                    <SelectItem value="Healthcare">Healthcare</SelectItem>
                    <SelectItem value="Finance">Finance</SelectItem>
                    <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                    <SelectItem value="Retail">Retail</SelectItem>
                    <SelectItem value="Education">Education</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input value={formData.industry || ""} disabled />
              )}
            </div>

            <div className="space-y-2">
              <Label>Company Size</Label>

              {isEditing ? (
                <Select
                  value={formData.companySize}
                  onValueChange={(value) =>
                    setFormData({ ...formData, companySize: value })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="1-10 employees">1–10 employees</SelectItem>
                    <SelectItem value="1-100 employees">1–100 employees</SelectItem>
                    <SelectItem value="101-500 employees">101–500 employees</SelectItem>
                    <SelectItem value="501-1000 employees">501–1000 employees</SelectItem>
                    <SelectItem value="1000+ employees">1000+ employees</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input value={formData.companySize || ""} disabled />
              )}
            </div>

            <div className="space-y-2">
              <Label>Founded Date</Label>

              {isEditing ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.foundedDate
                        ? format(new Date(formData.foundedDate), "PPP")
                        : "Pick a date"}
                    </Button>
                  </PopoverTrigger>

                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={
                        formData.foundedDate
                          ? new Date(formData.foundedDate)
                          : undefined
                      }
                      onSelect={(date) => {
                        if (!date) return;

                        setFormData({
                          ...formData,
                          foundedDate: `${date.getFullYear()}-${String(
                            date.getMonth() + 1
                          ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
                        });
                      }}
                    />
                  </PopoverContent>
                </Popover>
              ) : (
                <Input
                  value={
                    formData.foundedDate
                      ? format(new Date(formData.foundedDate), "PPP")
                      : ""
                  }
                  disabled
                />
              )}
            </div>

            <div className="space-y-2">
              <Label>Website URL</Label>
              <Input
                value={formData.website}
                onChange={(e) =>
                  setFormData({ ...formData, website: e.target.value })
                }
                disabled={!isEditing}
                placeholder="https://acme.com"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
          <CardDescription>Primary contact details for your organization.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Primary Email</Label>
              <Input
                type="email"
                value={formData.primaryEmail}
                onChange={(e) =>
                  setFormData({ ...formData, primaryEmail: e.target.value })
                }
                disabled={!isEditing}
                placeholder="contact@acme.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Support Email</Label>
              <Input
                type="email"
                value={formData.supportEmail}
                onChange={(e) =>
                  setFormData({ ...formData, supportEmail: e.target.value })
                }
                disabled={!isEditing}
                placeholder="support@acme.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                disabled={!isEditing}
                placeholder="+92 (555) 123-4567"
              />
            </div>
            <div className="space-y-2">
              <Label>Fax Number</Label>
              <Input
                value={formData.fax}
                onChange={(e) =>
                  setFormData({ ...formData, fax: e.target.value })
                }
                disabled={!isEditing}
                placeholder="+92 (555) 123-4568"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Business Address Card */}
      <Card>
        <CardHeader>
          <CardTitle>Business Address</CardTitle>
          <CardDescription>Primary business location.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Address Line 1</Label>
            <Input
              value={formData.addressLine1}
              onChange={(e) =>
                setFormData({ ...formData, addressLine1: e.target.value })
              }
              disabled={!isEditing}
              placeholder="123 Business Street"
            />
          </div>
          <div className="space-y-2">
            <Label>Address Line 2</Label>
            <Input
              value={formData.addressLine2}
              onChange={(e) =>
                setFormData({ ...formData, addressLine2: e.target.value })
              }
              disabled={!isEditing}
              placeholder="Suite 100"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>City</Label>
              <Input
                value={formData.city}
                onChange={(e) =>
                  setFormData({ ...formData, city: e.target.value })
                }
                disabled={!isEditing}
                placeholder="New York"
              />
            </div>
            <div className="space-y-2">
              <Label>State / Province</Label>
              <Input
                value={formData.state}
                onChange={(e) =>
                  setFormData({ ...formData, state: e.target.value })
                }
                disabled={!isEditing}
                placeholder="NY"
              />
            </div>
            <div className="space-y-2">
              <Label>ZIP / Postal Code</Label>
              <Input
                value={formData.zipCode}
                onChange={(e) =>
                  setFormData({ ...formData, zipCode: e.target.value })
                }
                disabled={!isEditing}
                placeholder="10001"
              />
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Input
                value={formData.country}
                onChange={(e) =>
                  setFormData({ ...formData, country: e.target.value })
                }
                disabled={!isEditing}
                placeholder="United States"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
