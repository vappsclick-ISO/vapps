"use client";

import { useEffect, useState } from "react";
import Header from "@/components/common/Header";
import { Button } from "@/components/ui/button";
import { UsersRound, Plus, Check, ArrowRight, Mail, Star, Building2, ChevronRight } from 'lucide-react';
import Link from "next/link";
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import axios from "axios";

interface Organization {
  id: string;
  name: string;
  role: string;
  createdAt: string;
  memberCount: number;
}

const HomePage = () => {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      const response = await axios.get("/api/organization/list");
      setOrganizations(response.data.organizations || []);
    } catch (error) {
      console.error("Error fetching organizations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role.toLowerCase()) {
      case "owner":
        return "text-[#432DD7] px-4 py-1 text-sm rounded-2xl bg-[#E0E7FF]";
      case "admin":
        return "text-[#155DFC] px-4 py-1 text-sm rounded-2xl bg-[#DBEAFE]";
      case "member":
        return "text-green-700 px-4 py-1 text-sm rounded-2xl bg-[#DCFCE7]";
      default:
        return "text-gray-700 px-4 py-1 text-sm rounded-2xl bg-gray-100";
    }
  };

  const getIconGradient = (index: number) => {
    const gradients = [
      "bg-[linear-gradient(135deg,#615FFF_0%,#9810FA_100%)]",
      "bg-[linear-gradient(135deg,#2B7FFF_0%,#4F39F6_100%)]",
      "bg-[linear-gradient(135deg,#00C950_0%,#009966_100%)]",
    ];
    return gradients[index % gradients.length];
  };

  // Check if user owns any organization
  const hasOwnedOrg = organizations.some(org => org.role.toLowerCase() === "owner");

  return (
    <>
      <Header />
      <section className="your-sites py-10">
        <div className="container mx-auto px-5">
          <div className="inner">
            <div className="all-sites mt-8">
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-4 capitalize">
                <Star size={20} fill="gold" stroke="gold" /> Your organizations
              </h2>

              {isLoading ? (
                <div className="text-center py-8 text-gray-500">Loading organizations...</div>
              ) : organizations.length === 0 ? (
                <div className="no-sites-box flex flex-col items-center gap-4 bg-[linear-gradient(135deg,#EEF2FF_0%,#FAF5FF_100%)] rounded-2xl p-8 md:p-10 border-2 border-[#0000001A] text-center">
                  <div className="user-icon bg-[linear-gradient(135deg,#615FFF_0%,#9810FA_100%)] 
              w-24 h-24 md:w-32 md:h-32 rounded-full flex items-center justify-center">
                    <UsersRound size={40} className="text-white" />
                  </div>
                  <h1 className="text-lg md:text-xl font-semibold">You're Not Part of Any Organization Yet</h1>
                  <p className="text-sm md:text-base text-gray-700 max-w-md">
                    Sites help you collaborate with your organization. Create a new site or join an existing one to get started.
                  </p>
                </div>
              ) : (
                <div className="site-cards flex flex-wrap gap-4">
                  {organizations.map((org, index) => (
                    <div
                      key={org.id}
                      onClick={() => router.push(`/dashboard/${org.id}`)}
                      className="site-card 
                        w-full md:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)]
                        border border-[#0000001A] rounded-2xl p-5 
                        bg-white shadow-sm flex flex-col justify-between
                        cursor-pointer hover:shadow-md transition-shadow"
                    >
                      {/* Header */}
                      <div className="card-header mb-4">
                        <div className="flex justify-between items-start">
                          <div className="flex items-start gap-4">
                            <div className={`site-icon ${getIconGradient(index)} p-3 rounded-lg`}>
                              <Building2 className="text-white" />
                            </div>

                            <div>
                              <h2 className="font-semibold text-base">{org.name}</h2>
                              <span className={getRoleBadgeStyle(org.role)}>
                                {org.role.charAt(0).toUpperCase() + org.role.slice(1)}
                              </span>
                            </div>
                          </div>

                          <ChevronRight className="text-gray-400" />
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="">
                        <p className="flex items-center gap-2 text-gray-600 text-sm">
                          <UsersRound size={18} /> {org.memberCount} {org.memberCount === 1 ? 'Member' : 'Members'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </section>
      <section className="org-option-card py-8">
        <div className="container mx-auto px-5">
          <div className={`inner flex flex-col ${hasOwnedOrg ? 'md:flex-row md:justify-center' : 'md:flex-row'} gap-6`}>

            {/* Create New Organization Card - Only show if user doesn't own an org */}
            {!hasOwnedOrg && (
              <div className="option-card w-full md:w-1/2 bg-white rounded-2xl shadow-lg p-6 border-2 border-[#0000001A] py-8 
      flex flex-col justify-between ">

                {/* Top content */}
                <div className="flex flex-col items-center ">

                  {/* Icon */}
                  <div className="card-icon w-20 h-20 rounded-full flex items-center justify-center 
          bg-[linear-gradient(135deg,#00C950_0%,#009966_100%)] 
          shadow-[0px_4px_6px_-4px_#0000001A] mb-4">
                    <Plus size={32} className="text-white" />
                  </div>

                  {/* Title */}
                  <h2 className="text-lg lg:text-xl font-semibold mb-2 text-center">
                    Create a New Organization
                  </h2>

                  {/* Description */}
                  <p className="text-sm md:text-base text-gray-600 mb-6 text-center">
                    Start fresh with your own Organization
                  </p>

                  {/* Features */}
                  <div className="card-points flex flex-col gap-4 w-full my-5">
                    <ul className="flex items-start gap-4">
                      <li>
                        <div className="icon w-6 h-6 flex items-center justify-center bg-[#DCFCE7] rounded-full">
                          <Check className="w-3 h-3 text-green-600" />
                        </div>
                      </li>
                      <li>
                        <span className="font-medium">Full Control</span>
                        <p className="text-sm text-gray-500">You'll be the owner with full administrative rights</p>
                      </li>
                    </ul>

                    <ul className="flex items-start gap-4">
                      <li>
                        <div className="icon w-6 h-6 flex items-center justify-center bg-[#DCFCE7] rounded-full">
                          <Check className="w-3 h-3 text-green-600" />
                        </div>
                      </li>
                      <li>
                        <span className="font-medium">Instant Access</span>
                        <p className="text-sm text-gray-500">Join immediately with an invite code</p>
                      </li>
                    </ul>

                    <ul className="flex items-start gap-4">
                      <li>
                        <div className="icon w-6 h-6 flex items-center justify-center bg-[#DCFCE7] rounded-full">
                          <Check className="w-3 h-3 text-green-600" />
                        </div>
                      </li>
                      <li>
                        <span className="font-medium">Collaborate</span>
                        <p className="text-sm text-gray-500">Work together with your colleagues</p>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Button stuck to bottom */}
                <Button asChild variant="default" size="lg" className="w-full flex items-center justify-center gap-2 mt-6">
                  <Link href="/organization-setup/step1">
                    Create Organization <ArrowRight />
                  </Link>
                </Button>
              </div>
            )}

            {/* Join Existing Organization Card */}
            <div className={`option-card ${hasOwnedOrg ? 'w-full md:w-1/2' : 'w-full md:w-1/2'} bg-white rounded-2xl shadow-lg p-6 border-2 border-[#0000001A] py-8 
      flex flex-col justify-between`}>

              {/* Top content */}
              <div className="flex flex-col items-center ">
                <div className="card-icon w-20 h-20 rounded-full flex items-center justify-center 
          bg-[linear-gradient(135deg,#2B7FFF_0%,#4F39F6_100%)]
          shadow-[0px_4px_6px_-4px_#0000001A] mb-4">
                  <Mail size={32} className="text-white" />
                </div>

                <h2 className="text-lg lg:text-xl font-semibold mb-2 text-center">
                  Join an Existing Workspace or Process
                </h2>

                <p className="text-sm md:text-base text-gray-600 mb-6 text-center">
                  Use an invite code or invitation link to join your workspace or process
                </p>

                <div className="card-points flex flex-col gap-4 w-full my-5">
                  <ul className="flex items-start gap-4">
                    <li>
                      <div className="icon w-6 h-6 flex items-center justify-center bg-[#DBEAFE] rounded-full">
                        <Check className="w-3 h-3 text-[#155DFC]" />
                      </div>
                    </li>
                    <li>
                      <span className="font-medium">Instant Access</span>
                      <p className="text-sm text-gray-500">Join immediately with an invite code</p>
                    </li>
                  </ul>

                  <ul className="flex items-start gap-4">
                    <li>
                      <div className="icon w-6 h-6 flex items-center justify-center bg-[#DBEAFE] rounded-full">
                        <Check className="w-3 h-3 text-[#155DFC]" />
                      </div>
                    </li>
                    <li>
                      <span className="font-medium">Collaborate</span>
                      <p className="text-sm text-gray-500">Work together with your colleagues</p>
                    </li>
                  </ul>

                  <ul className="flex items-start gap-4">
                    <li>
                      <div className="icon w-6 h-6 flex items-center justify-center bg-[#DBEAFE] rounded-full">
                        <Check className="w-3 h-3 text-[#155DFC]" />
                      </div>
                    </li>
                    <li>
                      <span className="font-medium">Shared Resources</span>
                      <p className="text-sm text-gray-500">Access team projects and documents</p>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Button at bottom */}
              <Dialog>
                <form>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="lg" className="w-full flex items-center justify-center gap-2 mt-6">
                      <Mail /> Join Organization <ArrowRight />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Join a Site</DialogTitle>
                      <DialogDescription>
                        Enter an invite code or email to join an existing Site
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4">
                      <div className="grid gap-3">
                        <Label htmlFor="invite-code">Invite code</Label>
                        <Input id="invite-code" name="invite-code" defaultValue="e.g., TEAM-ABC-123" />
                        <p>Ask your site admin for an invite code</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <Separator className="flex-1" /><span className="text-gray-500 text-sm">OR</span><Separator className="flex-1" />
                      </div>
                      <div className="grid gap-3">
                        <Label htmlFor="request-via-email">Request via email</Label>
                        <Input id="request-via-email" name="request-via-email" defaultValue="e.g., admin@company.com" />
                        <p>We'll send a request to join this team</p>
                      </div>
                    </div>
                    <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg p-4 mt-4">
                      <div className="flex gap-1.5">
                        <div className="rounded-full w-8 h-8 flex items-center justify-center bg-[#DBEAFE]">
                          <Mail size={16} className="text-[#1447E6]" />
                        </div>
                        <h3 className="font-semibold text-[#1C398E] text-sm">How it works</h3>
                      </div>
                      <ul className="list-disc pl-13">
                        <li className="text-[#1447E6] text-xs">Use an invite code for instant access</li>
                        <li className="text-[#1447E6] text-xs">Or request access via email</li>
                        <li className="text-[#1447E6] text-xs">Team admin will approve your request</li>
                      </ul>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                      </DialogClose>
                      <Button type="submit">Join Site</Button>
                    </DialogFooter>
                  </DialogContent>
                </form>
              </Dialog>


            </div>
          </div>

          {/* Support Text */}
          <p className="text-sm text-center mt-6">
            Need help? Contact <span className="text-[#4F39F6]">support@vapps.com</span>
          </p>
        </div >
      </section >
    </>
  )
}

export default HomePage