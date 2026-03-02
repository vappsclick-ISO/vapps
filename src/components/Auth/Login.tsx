"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";

import { Eye, EyeOff, Github, Apple, Chrome } from "lucide-react";

import { loginSchema, LoginInput } from "@/schemas/auth/auth.schema";
import { apiClient } from "@/lib/api-client";
type LoginProps = {
  onSwitch: () => void;
  inviteToken?: string;
  inviteEmail?: string;
};

const Login = ({ onSwitch, inviteToken, inviteEmail }: LoginProps) => {
  const router = useRouter();

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: inviteEmail || "",
    },
  });

  const onSubmit = async (data: LoginInput) => {
    try {
      setLoading(true);

      await apiClient.login(data); // credentials login API

      toast.success("Logged in successfully");

      // ✅ Redirect based on invite token
      if (inviteToken) {
        // If there's an invite token, redirect to invite page to auto-accept
        router.push(`/auth/invite?token=${inviteToken}`);
      } else {
        // Normal login flow
        router.push("/");
      }
      router.refresh(); // optional but recommended for auth state update
    } catch (error: any) {
      toast.error(error.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  // ✅ SSO HANDLER (NO RELOAD)
  const handleSSO = async (
    provider: "google" | "github" | "apple" | "atlassian"
  ) => {
    try {
      // Preserve invite token in callback URL if present
      const callbackUrl = inviteToken 
        ? `/auth/invite?token=${inviteToken}`
        : "/";
      
      await signIn(provider, {
        callbackUrl,
      });
    } catch {
      toast.error("SSO login failed");
    }
  };

  return (
    <div className="border border-[#E5E7EB] bg-white shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] p-8 rounded-2xl max-w-[400px] w-full mx-auto">
      {/* Heading */}
      <div className="text-center mb-8">
        <h1 className="text-xl mb-2">Welcome Back</h1>
        {inviteToken ? (
          <p className="text-base text-[#4A5565]">Log in to accept your invitation</p>
        ) : (
          <p className="text-base text-[#4A5565]">Login to your account</p>
        )}
      </div>

      {/* FORM */}
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Email */}
        <div className="mb-4">
          <Label className="text-sm mb-2">Email</Label>
          <Input 
            type="email" 
            placeholder="Email" 
            defaultValue={inviteEmail || ""}
            {...register("email")} 
          />
          {errors.email && (
            <p className="text-red-500 text-xs mt-1">
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Password */}
        <div className="mb-4">
          <Label className="text-sm mb-2">Password</Label>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              className="pr-10"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && (
            <p className="text-red-500 text-xs mt-1">
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Remember + Forgot */}
        <div className="flex justify-between items-center mb-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" /> Remember me
          </label>

          <Link
            href="/auth/forgot-password"
            className="text-sm text-[#4F39F6] hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        {/* Submit */}
        <Button className="w-full" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </Button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-4 my-6">
        <Separator className="flex-1" />
        <span className="text-sm text-gray-500">or continue with</span>
        <Separator className="flex-1" />
      </div>

      {/* ✅ SSO */}
      <div className="grid grid-cols-4 gap-2">
        <Button variant="outline" onClick={() => handleSSO("google")}>
          <Chrome size={16} />
        </Button>

        <Button variant="outline" onClick={() => handleSSO("atlassian")}>
          <Image src="/svgs/atlassian.svg" alt="Atlassian" width={16} height={16} />
        </Button>

        <Button variant="outline" onClick={() => handleSSO("github")}>
          <Github size={16} />
        </Button>

        <Button variant="outline" onClick={() => handleSSO("apple")}>
          <Apple size={16} />
        </Button>
      </div>

      {/* Switch */}
      <div className="text-center mt-6 text-sm text-gray-600">
        Don&apos;t have an account?{" "}
        <button
          onClick={onSwitch}
          className="text-[#16A34A] hover:underline"
        >
          Sign Up
        </button>
      </div>
    </div>
  );
};

export default Login;
