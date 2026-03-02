"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Loader2, Building2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import Image from "next/image";

interface Organization {
  id: string;
  name: string;
  role: string;
  createdAt: string;
  memberCount: number;
}

export default function ResolvePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const fetchOrganizations = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.getOrganizations();
      setOrganizations(response.organizations || []);
    } catch (err: any) {
      setError(err.message || "Failed to load organizations");
      toast.error("Failed to load organizations");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle authentication and data fetching
  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      router.push("/auth");
      return;
    }

    if (status === "authenticated") {
      fetchOrganizations();
    }
  }, [status, router]);

  // Handle auto-redirect when only one organization
  useEffect(() => {
    if (organizations.length === 1 && !isLoading && !isRedirecting) {
      setIsRedirecting(true);
      router.push(`/dashboard/${organizations[0].id}`);
    }
  }, [organizations, isLoading, isRedirecting, router]);

  const handleSelectOrg = (orgId: string) => {
    router.push(`/dashboard/${orgId}`);
  };

  // Show loading state
  if (status === "loading" || isLoading || isRedirecting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
        <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-sm text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">
            {isRedirecting ? "Redirecting..." : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  // Show nothing while redirecting unauthenticated users
  if (status === "unauthenticated") {
    return null;
  }

  // Show error state
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
        <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-sm text-center">
          <p className="text-destructive">{error}</p>
          <Button className="mt-4" onClick={fetchOrganizations}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Show no organizations message
  if (organizations.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
        <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-sm text-center">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-semibold">No Organizations</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You don't belong to any organizations yet.
          </p>
          <Button className="mt-6" onClick={() => router.push("/")}>
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  // If no organizations, show message
  if (organizations.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
        <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-sm text-center">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-semibold">No Organizations</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You don't belong to any organizations yet.
          </p>
          <Button className="mt-6" onClick={() => router.push("/")}>
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  // Multiple organizations - show selection
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-sm">
        {/* Logo */}
        <div className="mb-6 flex justify-center">
          <Image
            src="/images/logo.png"
            alt="Logo"
            width={140}
            height={60}
            priority
          />
        </div>

        {/* Heading */}
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold">Select Organization</h1>
          <p className="text-sm text-muted-foreground">
            You belong to multiple organizations. Please select one to continue.
          </p>
        </div>

        {/* Organization List */}
        <div className="space-y-3">
          {organizations.map((org) => (
            <Button
              key={org.id}
              variant="outline"
              className="w-full justify-start h-auto p-4"
              onClick={() => handleSelectOrg(org.id)}
            >
              <div className="flex items-center gap-3 w-full">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium">{org.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {org.role} • {org.memberCount} member{org.memberCount !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </Button>
          ))}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Logged in as: {session?.user?.email}
        </p>
      </div>
    </div>
  );
}

