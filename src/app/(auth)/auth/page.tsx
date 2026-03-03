"use client";

import React, { useState, useEffect, Suspense } from "react";
import Login from "@/components/Auth/Login";
import Register from "@/components/Auth/Register";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

function AuthPageContent() {
  const [isLogin, setIsLogin] = useState(true);
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const inviteEmail = searchParams.get("email");

  useEffect(() => {
    const verified = searchParams.get("verified");
    if (verified === "true") {
      toast.success("Email verified successfully!");
    }
    
    // If there's an invite token, show login form (not register)
    if (inviteToken) {
      setIsLogin(true);
    }
  }, [searchParams, inviteToken]);

  return (
    <div>
      {isLogin ? (
        <Login 
          onSwitch={() => setIsLogin(false)} 
          inviteToken={inviteToken || undefined}
          inviteEmail={inviteEmail || undefined}
        />
      ) : (
        <Register onSwitch={() => setIsLogin(true)} />
      )}
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-muted/40"><div className="animate-pulse text-muted-foreground">Loading...</div></div>}>
      <AuthPageContent />
    </Suspense>
  );
}