"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Chrome, GithubIcon, Loader2, XCircle } from "lucide-react";
import Image from "next/image";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import Link from "next/link";

interface InviteData {
  email: string;
  role: string;
  status?: string; // Include status to check if already accepted
  org: {
    id: string;
    name: string;
  };
  site: {
    id: string;
    name: string;
  } | null;
  process: {
    id: string;
    name: string;
  } | null;
  expiresAt: string;
}

export default function InvitePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const token = searchParams.get("token");

  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Fetch invitation details
  useEffect(() => {
    const fetchInvite = async () => {
      if (!token) {
        setError("Invalid invitation link. Token is missing.");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const data = await apiClient.resolveInvite(token);
        setInviteData(data);
        setEmail(data.email); // Pre-fill email from invitation
        
        // If invite is already accepted, redirect immediately
        if (data.status === "accepted") {
          router.push(`/auth/resolve`);
          return;
        }
      } catch (err: any) {
        // If invite is already accepted, redirect to resolve page
        if (err.message?.includes("already been accepted") || err.message?.includes("already used")) {
          router.push(`/auth/resolve`);
          return;
        }
        setError(err.message || "Failed to load invitation");
      } finally {
        setIsLoading(false);
      }
    };

    fetchInvite();
  }, [token, router]);

  // Auto-accept if user is logged in and email matches
  // Only runs if invite is still pending (not already accepted)
  useEffect(() => {
    const autoAccept = async () => {
      // Double-check conditions before accepting
      if (
        status === "authenticated" &&
        session?.user?.email &&
        inviteData &&
        token &&
        session.user.email.toLowerCase() === inviteData.email.toLowerCase() &&
        inviteData.status === "pending" &&
        !isAccepting
      ) {
        setIsAccepting(true);
        try {
          const result = await apiClient.acceptInvite(token);
          toast.success(`Successfully joined ${result.organizationName}!`);
          router.push(`/auth/resolve`);
        } catch (err: any) {
          // If invite was already accepted, just redirect (don't show error)
          if (err.message?.includes("already been accepted") || 
              err.message?.includes("already used") || 
              err.message?.includes("already been")) {
            // Invite already accepted, just redirect
            router.push(`/auth/resolve`);
          } else {
            toast.error(err.message || "Failed to accept invitation");
            setIsAccepting(false);
          }
        }
      }
    };

    // Only try to auto-accept if:
    // 1. User is authenticated
    // 2. Session email matches invite email
    // 3. Invite data is loaded
    // 4. Invite is still pending
    // 5. Not already accepting
    // 6. No errors
    if (
      status === "authenticated" && 
      session?.user?.email &&
      inviteData && 
      token && 
      !isAccepting && 
      !error &&
      inviteData.status === "pending" &&
      session.user.email.toLowerCase() === inviteData.email.toLowerCase()
    ) {
      // Small delay to ensure session is fully loaded
      const timer = setTimeout(() => {
        autoAccept();
      }, 100);
      
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session?.user?.email, inviteData?.email, inviteData?.status, token, isAccepting, error]);

  const handleAcceptInvite = async () => {
    if (!token) return;

    try {
      setIsAccepting(true);
      const result = await apiClient.acceptInvite(token);
      
      toast.success(`Successfully joined ${result.organizationName}!`);
      
      // Redirect to resolve page
      router.push(`/auth/resolve`);
    } catch (err: any) {
      toast.error(err.message || "Failed to accept invitation");
    } finally {
      setIsAccepting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }

    if (!token) {
      toast.error("Invalid invitation token");
      return;
    }

    try {
      setIsLoggingIn(true);
      
      // Try to accept invite with password (ONLY works for NEW users)
      // If user exists, this will return ACCOUNT_EXISTS error
      const result = await apiClient.acceptInviteWithPassword(token, password);
      
      // If successful, user was created - now log them in
      await new Promise(resolve => setTimeout(resolve, 500));
      await apiClient.login({ email, password });
      
      toast.success(`Successfully joined ${result.organizationName}!`);
      router.push(`/auth/resolve`);
    } catch (err: any) {
      // Check if error is ACCOUNT_EXISTS (user already has account)
      // The axios interceptor extracts error.response.data.error, so err.message will be "ACCOUNT_EXISTS"
      const errorMessage = err.message || "";
      
      if (errorMessage === "ACCOUNT_EXISTS" || errorMessage.toLowerCase().includes("account with this email already exists") || errorMessage.toLowerCase().includes("please log in")) {
        // User exists - they need to log in first, then accept invite
        toast.error("An account with this email already exists. Please log in to accept this invitation.");
        // Redirect to login page with invite token
        router.push(`/auth?invite=${token}&email=${encodeURIComponent(email)}`);
      } else {
        // Other errors (invalid password, etc.)
        const errorMsg = errorMessage || "Failed to accept invitation";
        toast.error(errorMsg);
        console.error("Invite acceptance error:", err);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSSO = async (provider: "google" | "github" | "atlassian") => {
    try {
      const callbackUrl = `/auth/invite?token=${token}`;
      await signIn(provider, {
        callbackUrl,
      });
    } catch {
      toast.error("SSO login failed");
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
        <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-sm text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error || !inviteData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
        <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-sm text-center">
          <XCircle className="mx-auto h-12 w-12 text-destructive" />
          <h1 className="mt-4 text-xl font-semibold">Invalid Invitation</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error || "This invitation link is invalid or has expired."}
          </p>
          <Link href="/auth">
            <Button className="mt-6" variant="outline">
              Go to Login
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // If already accepted (user logged in and email matches)
  if (status === "authenticated" && session?.user?.email?.toLowerCase() === inviteData.email.toLowerCase()) {
    if (isAccepting) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
          <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-sm text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">Accepting invitation...</p>
          </div>
        </div>
      );
    }
  }

  const roleText = inviteData.role === "admin" ? "Administrator" : inviteData.role === "owner" ? "Owner" : "Member";

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
          <h1 className="text-xl font-semibold">You've been invited</h1>
          <p className="text-sm text-muted-foreground">
            Join <strong>{inviteData.org.name}</strong> as a <strong>{roleText}</strong>
          </p>
          {inviteData.process && (
            <p className="mt-2 text-xs text-muted-foreground">
              Process: {inviteData.process.name}
            </p>
          )}
        </div>

        {/* Show different UI based on auth status */}
        {status === "authenticated" ? (
          // User is logged in - check if email matches
          session.user.email?.toLowerCase() === inviteData.email.toLowerCase() ? (
            // Email matches - show accept button
            <div className="space-y-4">
              <div className="rounded-lg border p-4 bg-muted/50">
                <p className="text-sm">
                  <strong>Logged in as:</strong> {session.user.email}
                </p>
                <p className="text-sm mt-2">
                  <strong>Organization:</strong> {inviteData.org.name}
                </p>
                <p className="text-sm mt-1">
                  <strong>Role:</strong> {roleText}
                </p>
              </div>
              <Button
                className="w-full"
                size="lg"
                onClick={handleAcceptInvite}
                disabled={isAccepting}
              >
                {isAccepting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Accepting...
                  </>
                ) : (
                  "Accept Invitation"
                )}
              </Button>
            </div>
          ) : (
            // Email doesn't match
            <div className="space-y-4">
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <p className="text-sm text-destructive">
                  This invitation was sent to <strong>{inviteData.email}</strong>, but you're logged in as{" "}
                  <strong>{session.user.email}</strong>.
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => signIn()}
              >
                Switch Account
              </Button>
            </div>
          )
        ) : (
          // User not logged in - show login form (email pre-filled, password required)
          <>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={true} // Email is pre-filled and disabled
                  required
                />
                <p className="text-xs text-muted-foreground">
                  This invitation was sent to: <strong>{inviteData.email}</strong>
                </p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoggingIn}
                  required
                />
              </div>

              <Button
                className="w-full"
                size="lg"
                type="submit"
                disabled={isLoggingIn}
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <Link href={`/auth?invite=${token}`} className="text-sm text-primary hover:underline">
                Don't have an account? Sign up
              </Link>
            </div>

            {/* Divider */}
            <div className="my-6 flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">OR</span>
              <Separator className="flex-1" />
            </div>

            {/* SSO Buttons */}
            <div className="space-y-3">
              <Button
                variant="outline"
                size="lg"
                className="w-full gap-2"
                onClick={() => handleSSO("google")}
                disabled={isLoggingIn}
              >
                <Chrome size={16} />
                Continue with Google
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="w-full gap-2"
                onClick={() => handleSSO("atlassian")}
                disabled={isLoggingIn}
              >
                <Image
                  src="/svgs/atlassian.svg"
                  alt="Atlassian"
                  width={16}
                  height={16}
                />
                Continue with Atlassian
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="w-full gap-2"
                onClick={() => handleSSO("github")}
                disabled={isLoggingIn}
              >
                <GithubIcon size={16} />
                Continue with GitHub
              </Button>
            </div>
          </>
        )}

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
