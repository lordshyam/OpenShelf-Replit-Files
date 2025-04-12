import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Mail } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface EmailVerificationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  onVerified?: () => void;
}

export function EmailVerificationDialog({
  isOpen,
  onClose,
  email,
  onVerified
}: EmailVerificationDialogProps) {
  const [verificationCode, setVerificationCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleVerify = async () => {
    if (!verificationCode.trim()) {
      setError("Please enter your verification code");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await apiRequest("POST", "/api/verify-email", {
        email,
        code: verificationCode.trim()
      });

      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: "Email verified successfully",
          description: "You can now log in to your account."
        });
        
        if (onVerified) {
          onVerified();
        }
        
        onClose();
      } else {
        setError(data.message || "Verification failed. Please check your code and try again.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during verification. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    setIsResending(true);
    setError(null);

    try {
      const response = await apiRequest("POST", "/api/resend-verification", {
        email
      });

      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: "Verification code sent",
          description: "A new verification code has been sent to your email."
        });
      } else {
        setError(data.message || "Failed to resend verification code. Please try again.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred when resending the code. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Verify Your Email</DialogTitle>
          <DialogDescription>
            Please enter the verification code sent to <strong>{email}</strong>
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="verification-code">Verification Code</Label>
            <Input
              id="verification-code"
              placeholder="Enter 6-digit code"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              maxLength={6}
            />
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            className="w-full sm:w-auto" 
            onClick={handleResendCode}
            disabled={isResending}
          >
            {isResending ? "Sending..." : "Resend Code"}
          </Button>
          <Button 
            className="w-full sm:w-auto" 
            onClick={handleVerify}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Verifying..." : "Verify Email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}