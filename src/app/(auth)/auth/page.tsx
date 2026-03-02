"use client";

import React, { useState, useEffect } from "react";
import Login from "@/components/Auth/Login";
import Register from "@/components/Auth/Register";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

const AuthPage = () => {
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
};

export default AuthPage;