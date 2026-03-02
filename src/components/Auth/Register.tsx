"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";

import { Eye, EyeOff, Github, Apple, Chrome } from "lucide-react";
import Image from "next/image";

import { registerSchema, RegisterInput } from "@/schemas/auth/auth.schema";
import { apiClient } from "@/lib/api-client";

type RegisterProps = {
  onSwitch: () => void;
};

const Register = ({ onSwitch }: RegisterProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  // ✅ REGISTER HANDLER
  const onSubmit = async (data: RegisterInput) => {
    try {
      setLoading(true);

      await apiClient.register(data);

      toast.success(
        "Account created! Please check your email to verify your account."
      );

      reset();
      onSwitch(); // switch to login
    } catch (error: any) {
      toast.error(error.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-[#E5E7EB] bg-[#FFFFFF] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] p-8 rounded-2xl max-w-[400px] w-full mx-auto">
      {/* Heading */}
      <div className="text-center mb-8">
        <h1 className="text-xl mb-2">Create Account</h1>
        <p className="text-base text-[#4A5565]">
          Start your journey with VApps
        </p>
      </div>

      {/* FORM */}
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Email */}
        <div className="mb-4">
          <Label htmlFor="email" className="text-sm mb-2">
            Email
          </Label>
          <Input placeholder="Email" type="email" {...register("email")} />
          {errors.email && (
            <p className="text-red-500 text-xs mt-1">
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Password */}
        <div className="mb-4">
          <Label htmlFor="password" className="text-sm mb-2">
            Password
          </Label>
          <div className="relative">
            <Input
              placeholder="Password"
              type={showPassword ? "text" : "password"}
              className="pr-10"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {errors.password && (
            <p className="text-red-500 text-xs mt-1">
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Confirm Password */}
        <div className="mb-6">
          <Label htmlFor="confirmPassword" className="text-sm mb-2">
            Confirm Password
          </Label>
          <div className="relative">
            <Input
              placeholder="Confirm Password"
              type={showPassword ? "text" : "password"}
              className="pr-10"
              {...register("confirmPassword")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-red-500 text-xs mt-1">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        {/* Submit */}
        <Button
          disabled={loading}
          className="w-full text-white py-2 text-sm hover:bg-[#6db966]"
          variant="default"
        >
          {loading ? "Creating Account..." : "Create Account"}
        </Button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-4 my-6">
        <Separator className="flex-1" />
        <span className="text-gray-500 text-sm">or continue with</span>
        <Separator className="flex-1" />
      </div>

      {/* SOCIAL LOGIN */}
      <div className="grid grid-cols-4 gap-2.5 mb-6">
        <Button
          type="button"
          variant="outline"
          className="flex justify-center"
          onClick={() => signIn("google")}
        >
          <Chrome size={16} />
        </Button>

        <Button
          type="button"
          variant="outline"
          className="flex justify-center"
          onClick={() => signIn("atlassian")}
        >
          <Image
            src="/svgs/atlassian.svg"
            alt="atlassian"
            width={16}
            height={16}
          />
        </Button>

        <Button
          type="button"
          variant="outline"
          className="flex justify-center"
          onClick={() => signIn("github")}
        >
          <Github size={16} />
        </Button>

        <Button
          type="button"
          variant="outline"
          className="flex justify-center"
          onClick={() => signIn("apple")}
        >
          <Apple size={16} />
        </Button>
      </div>

      {/* Switch */}
      <div className="text-center text-sm text-gray-600">
        Already have an account?{" "}
        <button
          onClick={onSwitch}
          className="text-[#16A34A] text-base hover:underline"
        >
          Log In
        </button>
      </div>
    </div>
  );
};

export default Register;
