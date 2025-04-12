import { createContext, ReactNode, useContext, useState } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type VerificationInfo = {
  email: string;
  needsVerification: boolean;
  message?: string;
};

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, InsertUser>;
  verificationInfo: VerificationInfo | null;
};

type LoginData = {
  email: string;
  password: string;
  rememberMe?: boolean;
};

export const AuthContext = createContext<AuthContextType | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [verificationInfo, setVerificationInfo] = useState<VerificationInfo | null>(null);
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      try {
        const res = await apiRequest("POST", "/api/login", credentials);
        const data = await res.json();
        
        // Check if response contains needsVerification flag, indicating email needs verification
        if (res.status === 401 && data.needsVerification) {
          throw new Error(JSON.stringify({
            message: data.message || "Email verification required",
            needsVerification: true,
            email: data.email
          }));
        }
        
        if (!res.ok) {
          throw new Error(data.message || "Login failed");
        }
        
        return data;
      } catch (err: any) {
        // Rethrow special errors we created above
        if (err.message && err.message.startsWith('{"message":')) {
          throw err;
        }
        // Otherwise throw a generic error
        throw new Error(err.message || "Login failed");
      }
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
    },
    onError: (error: Error) => {
      try {
        // Check if the error is a structured verification error
        const errorData = JSON.parse(error.message);
        if (errorData.needsVerification) {
          // Set verification info to trigger dialog
          setVerificationInfo({
            email: errorData.email,
            needsVerification: true,
            message: errorData.message || "Please verify your email to continue"
          });
          
          // Use toast for verification notification but don't mark as destructive
          toast({
            title: "Email verification required",
            description: errorData.message || "Please verify your email to continue",
          });
          // Don't display an additional error toast
          return;
        }
      } catch (e) {
        // Not a structured error, continue with normal error toast
      }
      
      // Display normal error toast
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      const res = await apiRequest("POST", "/api/register", credentials);
      return await res.json();
    },
    onSuccess: (response: any) => {
      // Only set the user data if they don't need verification
      if (!response.needsVerification) {
        queryClient.setQueryData(["/api/user"], response);
      }
      // The verification UI will be handled in the auth-page component
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
        verificationInfo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
