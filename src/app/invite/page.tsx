"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Legacy redirect page - redirects /invite to /auth/invite
 * This maintains backward compatibility with old invite links
 */
function LegacyInvitePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  useEffect(() => {
    if (token) {
      router.replace(`/auth/invite?token=${token}`);
    } else {
      router.replace("/auth/invite");
    }
  }, [token, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-sm text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  );
}

export default function LegacyInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
          <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-sm text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">Redirecting...</p>
          </div>
        </div>
      }
    >
      <LegacyInvitePageContent />
    </Suspense>
  );
}
