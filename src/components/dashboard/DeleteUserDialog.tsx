"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";

interface DeleteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  userId: string;
  userName: string;
  userEmail: string;
  onUserDeleted?: () => void;
}

export default function DeleteUserDialog({
  open,
  onOpenChange,
  orgId,
  userId,
  userName,
  userEmail,
  onUserDeleted,
}: DeleteUserDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = async () => {
    setIsLoading(true);

    try {
      await apiClient.delete(`/organization/${orgId}/members/${userId}`);
      toast.success("User removed from organization successfully");
      onOpenChange(false);
      onUserDeleted?.();
    } catch (error: any) {
      console.error("Error removing user:", error);
      const message = error?.message || "Failed to remove user. Please try again.";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Remove User
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to remove this user from the organization? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="rounded-md bg-red-50 border border-red-200 p-4">
            <p className="text-sm font-medium text-red-800 mb-1">{userName}</p>
            <p className="text-sm text-red-600">{userEmail}</p>
          </div>
          <p className="text-sm text-gray-600 mt-4">
            This user will lose access to all organization resources, sites, and processes.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isLoading}>
            {isLoading ? "Removing..." : "Remove User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
