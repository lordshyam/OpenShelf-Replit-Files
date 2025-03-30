import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, verifyEmailSchema, type InsertUser } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { BookOpen, Eye, EyeOff } from "lucide-react";
import { z } from 'zod';
import { useMutation } from "@tanstack/react-query";

interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

// Create a schema for login validation
const loginSchema = z.object({
  email: z.string().email("Please enter a valid email").min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().default(false)
});

// Verification form data
interface VerificationFormData {
  email: string;
  code: string;
}

// Resend verification code form data
interface ResendVerificationFormData {
  email: string;
}

// Legacy account verification form data
interface LegacyVerificationFormData {
  email: string;
  password: string;
}

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [showLegacyVerification, setShowLegacyVerification] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  useEffect(() => {
    if (user) {
      if (!user.communityId) {
        setLocation("/select-community");
      } else {
        setLocation("/");
      }
    }
  }, [user, setLocation]);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { 
      email: "", 
      password: "",
      rememberMe: false 
    },
  });

  const registerForm = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: { username: "", email: "", password: "" },
  });

  const verificationForm = useForm<VerificationFormData>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: {
      email: "",
      code: ""
    }
  });

  const resendForm = useForm<ResendVerificationFormData>({
    defaultValues: {
      email: ""
    }
  });
  
  const legacyVerificationForm = useForm<LegacyVerificationFormData>({
    defaultValues: {
      email: "",
      password: ""
    }
  });

  // Verification mutations
  const verifyEmailMutation = useMutation({
    mutationFn: async (data: VerificationFormData) => {
      const response = await apiRequest(
        'POST',
        '/api/verify-email',
        data
      );
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Email verified successfully",
        description: "You can now log in to your account.",
      });
      setShowVerification(false);
      // Update form values
      loginForm.setValue("email", data.email || "");
      loginForm.setValue("password", "");
    },
    onError: (error: Error) => {
      toast({
        title: "Verification failed",
        description: error.message || "Please check your verification code and try again.",
        variant: "destructive",
      });
    }
  });

  const resendVerificationMutation = useMutation({
    mutationFn: async (data: ResendVerificationFormData) => {
      const response = await apiRequest(
        'POST',
        '/api/resend-verification',
        data
      );
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Verification code sent",
        description: "Please check your email for the verification code.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error sending verification code",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    }
  });
  
  const legacyVerificationMutation = useMutation({
    mutationFn: async (data: LegacyVerificationFormData) => {
      const response = await apiRequest(
        'POST',
        '/api/mark-verified',
        data
      );
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Account verified successfully",
        description: "You are now logged in.",
      });
      setShowLegacyVerification(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Verification failed",
        description: error.message || "Please check your credentials and try again.",
        variant: "destructive",
      });
    }
  });
  
  // Handle login errors
  useEffect(() => {
    if (loginMutation.isError) {
      const error = loginMutation.error as any;
      // Check if the error is due to unverified email
      if (error?.needsVerification) {
        setRegisteredEmail(error?.email || "");
        verificationForm.setValue("email", error?.email || "");
        resendForm.setValue("email", error?.email || "");
        legacyVerificationForm.setValue("email", error?.email || "");
        
        // If this is an account created before verification was implemented
        // Show the legacy verification form option
        setShowVerification(true);
        toast({
          title: "Email verification required",
          description: "Please verify your email to log in.",
        });
      } else {
        toast({
          title: "Login failed",
          description: error?.message || "Invalid credentials",
          variant: "destructive",
        });
      }
    }
  }, [loginMutation.isError, loginMutation.error, toast, verificationForm, resendForm, legacyVerificationForm]);

  return (
    <div className="min-h-screen grid md:grid-cols-2 gap-6 p-4 bg-background">
      <div className="flex items-center justify-center">
        {showVerification ? (
          <Card className="w-full max-w-md">
            {showLegacyVerification ? (
              <>
                <CardHeader>
                  <CardTitle>Verify Existing Account</CardTitle>
                  <CardDescription>
                    Enter your credentials to verify your existing account
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...legacyVerificationForm}>
                    <form onSubmit={legacyVerificationForm.handleSubmit((data) => legacyVerificationMutation.mutate(data))} className="space-y-4">
                      <FormField
                        control={legacyVerificationForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input {...field} type="email" placeholder="Enter your email" readOnly />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={legacyVerificationForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type={showPassword ? "text" : "password"}
                                  {...field}
                                  placeholder="Enter your password"
                                />
                                <button
                                  type="button"
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                  onMouseDown={() => setShowPassword(true)}
                                  onMouseUp={() => setShowPassword(false)}
                                  onMouseLeave={() => setShowPassword(false)}
                                >
                                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={legacyVerificationMutation.isPending}
                      >
                        {legacyVerificationMutation.isPending ? "Verifying..." : "Verify Account"}
                      </Button>
                    </form>
                  </Form>
                  
                  <Button 
                    variant="link" 
                    className="mt-4 p-0 h-auto w-full text-center" 
                    onClick={() => setShowLegacyVerification(false)}
                  >
                    Use Verification Code Instead
                  </Button>
                </CardContent>
              </>
            ) : (
              <>
                <CardHeader>
                  <CardTitle>Verify Your Email</CardTitle>
                  <CardDescription>
                    Please enter the verification code sent to {registeredEmail}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...verificationForm}>
                    <form onSubmit={verificationForm.handleSubmit((data) => verifyEmailMutation.mutate(data))} className="space-y-4">
                      <FormField
                        control={verificationForm.control}
                        name="code"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Verification Code</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter 6-digit code" maxLength={6} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={verifyEmailMutation.isPending}
                      >
                        {verifyEmailMutation.isPending ? "Verifying..." : "Verify Email"}
                      </Button>
                    </form>
                  </Form>

                  <div className="mt-6">
                    <p className="text-sm text-muted-foreground mb-2">Didn't receive a code?</p>
                    <Form {...resendForm}>
                      <form onSubmit={resendForm.handleSubmit((data) => resendVerificationMutation.mutate(data))} className="space-y-4">
                        <Button
                          type="submit"
                          variant="outline"
                          className="w-full"
                          disabled={resendVerificationMutation.isPending}
                        >
                          {resendVerificationMutation.isPending ? "Sending..." : "Resend Verification Code"}
                        </Button>
                      </form>
                    </Form>
                  </div>

                  <div className="mt-4 border-t pt-4">
                    <p className="text-sm text-muted-foreground mb-2">Have an existing account created before verification?</p>
                    <Button 
                      variant="secondary" 
                      className="w-full" 
                      onClick={() => setShowLegacyVerification(true)}
                    >
                      Verify Existing Account
                    </Button>
                  </div>

                  <Button 
                    variant="link" 
                    className="mt-4 p-0 h-auto w-full text-center" 
                    onClick={() => setShowVerification(false)}
                  >
                    Back to Login
                  </Button>
                </CardContent>
              </>
            )}
          </Card>
        ) : (
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>OpenShelf</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="login">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Login</TabsTrigger>
                  <TabsTrigger value="register">Register</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit((data) => loginMutation.mutate(data))} className="space-y-4">
                      <FormField
                        control={loginForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input {...field} type="email" placeholder="Enter your email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={loginForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type={showPassword ? "text" : "password"}
                                  {...field}
                                  placeholder="Enter your password"
                                />
                                <button
                                  type="button"
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                  onMouseDown={() => setShowPassword(true)}
                                  onMouseUp={() => setShowPassword(false)}
                                  onMouseLeave={() => setShowPassword(false)}
                                >
                                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={loginForm.control}
                        name="rememberMe"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="text-sm font-normal">Stay Logged In</FormLabel>
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full">
                        {loginMutation.isPending ? "Logging in..." : "Login"}
                      </Button>
                    </form>
                  </Form>
                </TabsContent>

                <TabsContent value="register">
                  <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit((data) => {
                      registerMutation.mutate(data, {
                        onSuccess: (response: any) => {
                          // Check if verification is needed
                          if (response.needsVerification) {
                            setRegisteredEmail(response.email);
                            verificationForm.setValue("email", response.email);
                            resendForm.setValue("email", response.email);
                            setShowVerification(true);
                            
                            toast({
                              title: "Registration successful",
                              description: response.message || "Please check your email for the verification code.",
                            });
                          } else {
                            toast({
                              title: "Registration successful",
                              description: "Your account has been created!",
                            });
                          }
                        }
                      });
                    })} className="space-y-4">
                      <FormField
                        control={registerForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Choose a username" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" {...field} placeholder="Enter your email address" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input 
                                  type={showPassword ? "text" : "password"} 
                                  {...field} 
                                  placeholder="Create a strong password" 
                                />
                                <button
                                  type="button"
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                  onMouseDown={() => setShowPassword(true)}
                                  onMouseUp={() => setShowPassword(false)}
                                  onMouseLeave={() => setShowPassword(false)}
                                >
                                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full">
                        {registerForm.formState.isSubmitting ? "Creating account..." : "Create Account"}
                      </Button>
                    </form>
                  </Form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="hidden md:flex flex-col justify-center items-center bg-primary text-primary-foreground p-8 rounded-lg">
        <BookOpen className="h-16 w-16 mb-4" />
        <h1 className="text-3xl font-bold mb-4">Welcome to OpenShelf</h1>
        <p className="text-lg text-center mb-6">
          Join our community-driven book sharing platform. Share your books, discover new reads, and connect with fellow book lovers.
        </p>
        <ul className="space-y-2">
          <li>✓ Share books and earn credits</li>
          <li>✓ Borrow books using your credits</li>
          <li>✓ Connect with other readers</li>
          <li>✓ Build your reading community</li>
        </ul>
      </div>
    </div>
  );
}