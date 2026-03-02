"use client";

import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import { Camera, Mail, Phone, MapPin, Calendar as CalendarIcon, Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Profile = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  phone: string | null;
  location: string | null;
  bio: string | null;
  jobTitle: string | null;
  department: string | null;
  employeeId: string | null;
  reportsTo: string | null;
  joinDate: string | null;
  createdAt: string;
};

const emptyProfile: Profile = {
  id: "",
  name: null,
  email: null,
  image: null,
  phone: null,
  location: null,
  bio: null,
  jobTitle: null,
  department: null,
  employeeId: null,
  reportsTo: null,
  joinDate: null,
  createdAt: "",
};

function profileToForm(p: Profile) {
  const name = p.name ?? "";
  const [firstName, lastName] = name ? name.trim().split(/\s+/, 2) : ["", ""];
  return {
    firstName: firstName || "",
    lastName: lastName || "",
    email: p.email ?? "",
    phone: p.phone ?? "",
    location: p.location ?? "",
    bio: p.bio ?? "",
    jobTitle: p.jobTitle ?? "",
    department: p.department ?? "",
    employeeId: p.employeeId ?? "",
    joinDate: p.joinDate ? format(new Date(p.joinDate), "yyyy-MM-dd") : "",
    reportsTo: p.reportsTo ?? "",
  };
}

export default function AccountPage() {
  const { data: session, status, update: updateSession } = useSession();
  const params = useParams();
  const orgId = params?.orgId as string;

  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(profileToForm(emptyProfile));
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarTimestamp, setAvatarTimestamp] = useState(0);
  const [orgMembership, setOrgMembership] = useState<{
    leadershipTier: string;
    systemRole: string;
    jobTitle: string | null;
    isOwner: boolean;
  } | null>(null);
  const hasLoadedProfileOnce = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProfile = useCallback(async (showError = true) => {
    try {
      setLoading(true);
      const data = await apiClient.getProfile();
      hasLoadedProfileOnce.current = true;
      setProfile(data);
      setForm(profileToForm(data));
    } catch {
      if (showError) toast.error("Failed to load profile");
      // Don't overwrite with empty if we had already loaded a profile (e.g. refetch failed)
      if (!hasLoadedProfileOnce.current) {
        setProfile(emptyProfile);
        setForm(profileToForm(emptyProfile));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") fetchProfile(true);
  }, [status, fetchProfile]);

  useEffect(() => {
    if (!orgId || status !== "authenticated") return;
    apiClient
      .getMyOrgMembership(orgId)
      .then(setOrgMembership)
      .catch(() => setOrgMembership(null));
  }, [orgId, status]);

  // Refetch when user returns to this tab so we show latest saved data after login
  useEffect(() => {
    const onFocus = () => {
      if (status === "authenticated") fetchProfile(false);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [status, fetchProfile]);

  const handleEdit = () => {
    setForm(profileToForm(profile));
    setIsEditing(true);
  };

  const handleCancel = () => {
    setForm(profileToForm(profile));
    setIsEditing(false);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setAvatarUploading(true);
      await apiClient.uploadProfileAvatar(file);
      await fetchProfile(false);
      setAvatarTimestamp(Date.now());
      await updateSession?.({ image: `/api/user/avatar?t=${Date.now()}` });
      toast.success("Profile picture updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload picture");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSave = async () => {
    const name = [form.firstName.trim(), form.lastName.trim()].filter(Boolean).join(" ") || undefined;
    try {
      setSaving(true);
      const updated = await apiClient.updateProfile({
        name,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        location: form.location.trim() || undefined,
        bio: form.bio.trim() || undefined,
        jobTitle: form.jobTitle.trim() || undefined,
        department: form.department.trim() || undefined,
        employeeId: form.employeeId.trim() || undefined,
        reportsTo: form.reportsTo.trim() || undefined,
        joinDate: form.joinDate ? form.joinDate : undefined,
      }) as typeof profile & { emailVerificationSent?: boolean; message?: string };
      setProfile(updated);
      setIsEditing(false);
      if (updated.emailVerificationSent && updated.message) {
        toast.success(updated.message);
        await fetchProfile(false);
      } else {
        await updateSession?.({
          name: updated.name != null ? updated.name : undefined,
          email: updated.email != null ? updated.email : undefined,
          image: updated.image != null ? updated.image : undefined,
        });
        toast.success("Profile updated");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const user = session?.user as { name?: string | null; email?: string | null; image?: string | null } | undefined;
  const displayName = (profile.name || user?.name) ?? "";
  const displayEmail = (profile.email || user?.email) ?? "";
  const [firstName, lastName] = displayName ? displayName.trim().split(/\s+/, 2) : ["", ""];
  // S3 key: use app avatar URL; external URL (OAuth): use as-is
  const displayImage =
    profile.image && !profile.image.startsWith("http")
      ? `/api/user/avatar?t=${avatarTimestamp || ""}`
      : (profile.image || user?.image) ?? null;
  const roleTags = orgMembership
    ? [orgMembership.jobTitle, orgMembership.leadershipTier, orgMembership.systemRole].filter(
        (t): t is string => t != null && String(t).trim() !== ""
      )
    : [];

  if (loading && !profile.id) {
    return (
      <div className="flex items-center justify-center min-h-[320px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#6A7282]" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-semibold text-[#0A0A0A] tracking-tight">My Profile</h1>
        <p className="text-sm text-[#6A7282] mt-1">Manage your personal information and preferences</p>
      </div>

      <div className="space-y-6">
          {/* User Profile Card */}
          <Card className="border border-[#0000001A] shadow-sm rounded-xl overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-start gap-4 flex-wrap">
                <div className="relative shrink-0">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                  <Avatar className="h-20 w-20 rounded-full border-2 border-[#F3F3F5]">
                    <AvatarImage src={displayImage ?? undefined} alt={displayName || "Profile"} />
                    <AvatarFallback className="bg-[#E5E7EB] text-[#374151] text-lg">
                      {firstName && lastName ? `${firstName[0]}${lastName[0]}` : displayEmail?.slice(0, 2)?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    disabled={avatarUploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-[#0A0A0A] text-white shadow hover:bg-[#333] transition-colors disabled:opacity-60 disabled:pointer-events-none"
                    aria-label="Change profile picture"
                  >
                    {avatarUploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Camera className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-lg text-[#0A0A0A]">{displayName || "—"}</h2>
                  <p className="text-sm text-[#6A7282] mt-0.5">{displayEmail || "—"}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {roleTags.length > 0 ? (
                      roleTags.map((tag) => (
                        <span key={tag} className="inline-flex items-center rounded-full bg-[#F3F3F5] px-3 py-1 text-xs font-medium text-[#374151]">
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-[#6A7282]">No role assigned in this organization</span>
                    )}
                  </div>
                </div>
                {!isEditing ? (
                  <Button className="rounded-lg bg-[#0A0A0A] text-white hover:bg-[#333] shrink-0" size="sm" onClick={handleEdit}>
                    Edit Profile
                  </Button>
                ) : (
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={handleCancel} disabled={saving}>
                      Cancel
                    </Button>
                    <Button className="rounded-lg bg-[#0A0A0A] text-white hover:bg-[#333]" size="sm" onClick={handleSave} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Personal Information */}
          <Card className="border border-[#0000001A] shadow-sm rounded-xl overflow-hidden">
            <CardHeader>
              <CardTitle className="text-[#0A0A0A]">Personal Information</CardTitle>
              <CardDescription>Update your personal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[#374151] text-sm">First Name</Label>
                  <Input
                    readOnly={!isEditing}
                    value={form.firstName}
                    onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                    className="bg-[#F9FAFB] border-[#E5E7EB] rounded-lg text-[#0A0A0A] read-only:cursor-default"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#374151] text-sm">Last Name</Label>
                  <Input
                    readOnly={!isEditing}
                    value={form.lastName}
                    onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                    className="bg-[#F9FAFB] border-[#E5E7EB] rounded-lg text-[#0A0A0A] read-only:cursor-default"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[#374151] text-sm flex items-center gap-2">
                  <Mail className="h-4 w-4 text-[#6A7282]" /> Email Address
                </Label>
                <Input
                  readOnly={!isEditing}
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="bg-[#F9FAFB] border-[#E5E7EB] rounded-lg text-[#0A0A0A] read-only:cursor-default"
                />
                <p className="text-xs text-[#6A7282]">
                  Changing your email will send a verification link to the new address. Your email will update after you confirm.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-[#374151] text-sm flex items-center gap-2">
                  <Phone className="h-4 w-4 text-[#6A7282]" /> Phone Number
                </Label>
                <Input
                  readOnly={!isEditing}
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="bg-[#F9FAFB] border-[#E5E7EB] rounded-lg text-[#0A0A0A] read-only:cursor-default"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[#374151] text-sm flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#6A7282]" /> Location
                </Label>
                <Input
                  readOnly={!isEditing}
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  className="bg-[#F9FAFB] border-[#E5E7EB] rounded-lg text-[#0A0A0A] read-only:cursor-default"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[#374151] text-sm">Bio</Label>
                <textarea
                  readOnly={!isEditing}
                  value={form.bio}
                  onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-sm text-[#0A0A0A] resize-none read-only:cursor-default"
                />
              </div>
            </CardContent>
          </Card>

          {/* Work Information */}
          <Card className="border border-[#0000001A] shadow-sm rounded-xl overflow-hidden">
            <CardHeader>
              <CardTitle className="text-[#0A0A0A]">Work Information</CardTitle>
              <CardDescription>Your role and department details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[#374151] text-sm">Job Title</Label>
                  <Input
                    readOnly={!isEditing}
                    value={form.jobTitle}
                    onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))}
                    className="bg-[#F9FAFB] border-[#E5E7EB] rounded-lg text-[#0A0A0A] read-only:cursor-default"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#374151] text-sm">Department</Label>
                  <Input
                    readOnly={!isEditing}
                    value={form.department}
                    onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                    className="bg-[#F9FAFB] border-[#E5E7EB] rounded-lg text-[#0A0A0A] read-only:cursor-default"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[#374151] text-sm">Employee ID</Label>
                  <Input
                    readOnly={!isEditing}
                    value={form.employeeId}
                    onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}
                    className="bg-[#F9FAFB] border-[#E5E7EB] rounded-lg text-[#0A0A0A] read-only:cursor-default"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#374151] text-sm flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-[#6A7282]" /> Join Date
                  </Label>
                  {isEditing ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal bg-[#F9FAFB] border-[#E5E7EB] rounded-lg text-[#0A0A0A] hover:bg-[#F3F3F5]"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 text-[#6A7282]" />
                          {form.joinDate
                            ? format(new Date(form.joinDate), "PPP")
                            : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={form.joinDate ? new Date(form.joinDate) : undefined}
                          onSelect={(date) => {
                            if (!date) return;
                            setForm((f) => ({
                              ...f,
                              joinDate: format(date, "yyyy-MM-dd"),
                            }));
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <div className="flex h-9 w-full items-center rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 text-sm text-[#0A0A0A]">
                      {form.joinDate
                        ? format(new Date(form.joinDate), "PPP")
                        : "—"}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[#374151] text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-[#6A7282]" /> Reports To
                </Label>
                <Input
                  readOnly={!isEditing}
                  value={form.reportsTo}
                  onChange={(e) => setForm((f) => ({ ...f, reportsTo: e.target.value }))}
                  className="bg-[#F9FAFB] border-[#E5E7EB] rounded-lg text-[#0A0A0A] read-only:cursor-default"
                />
              </div>
            </CardContent>
          </Card>
      </div>
    </div>
  );
}
