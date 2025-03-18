import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, verifyEmailSchema, type InsertUser } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Eye, EyeOff } from "lucide-react";

interface LoginFormData {
  username: string;
  password: string;
  rememberMe: boolean;
}

export default function AuthPage() {
  const { user, loginMutation } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [pendingVerification, setPendingVerification] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (user) {
      // If user has no community, redirect to community selection
      if (!user.communityId) {
        setLocation("/select-community");
      } else {
        setLocation("/");
      }
    }
  }, [user, setLocation]);

  const loginForm = useForm<LoginFormData>({
    defaultValues: { 
      username: "", 
      password: "",
      rememberMe: false 
    },
  });

  const registerForm = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: { username: "", email: "", password: "" },
  });

  const verificationForm = useForm({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: {
      email: "",
      code: ""
    },
  });

  // When pendingVerification changes, update form default values
  useEffect(() => {
    if (pendingVerification) {
      verificationForm.reset({ email: pendingVerification, code: "" });
    }
  }, [pendingVerification, verificationForm]);

  const handleVerification = async (data: { code: string }) => {
    if (!pendingVerification) return;

    try {
      const res = await apiRequest("POST", "/api/verify-email", {
        email: pendingVerification,
        code: data.code,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Verification failed");
      }

      const result = await res.json();
      toast({
        title: "Success!",
        description: result.message,
      });
      setPendingVerification(null); // Clear the pending verification
    } catch (error: any) {
      toast({
        title: "Verification failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 gap-6 p-4 bg-background">
      <div className="flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>OpenShelf</CardTitle>
          </CardHeader>
          <CardContent>
            {pendingVerification ? (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Verify your email</h2>
                <p className="text-sm text-muted-foreground">
                  We've sent a verification code to {pendingVerification}.
                  Please check your email and enter the code below.
                </p>
                <Form {...verificationForm}>
                  <form onSubmit={verificationForm.handleSubmit(handleVerification)} className="space-y-4">
                    <FormField
                      control={verificationForm.control}
                      name="code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Verification Code</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Enter 6-digit code" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={!verificationForm.formState.isValid || verificationForm.formState.isSubmitting}
                    >
                      {verificationForm.formState.isSubmitting ? "Verifying..." : "Verify Email"}
                    </Button>
                  </form>
                </Form>
              </div>
            ) : (
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
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username or Email</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter your username or email" />
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
                      <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                        {loginMutation.isPending ? "Logging in..." : "Login"}
                      </Button>
                    </form>
                  </Form>
                </TabsContent>

                <TabsContent value="register">
                  <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit(async (data) => {
                      try {
                        const response = await apiRequest("POST", "/api/register", data);
                        const result = await response.json();

                        if (response.ok) {
                          setPendingVerification(data.email);
                          toast({
                            title: "Registration successful",
                            description: "Verification code sent! Please check both your inbox and spam folder.",
                          });
                        } else {
                          throw new Error(result.message || "Registration failed");
                        }
                      } catch (error: any) {
                        toast({
                          title: "Registration failed",
                          description: error.message,
                          variant: "destructive",
                        });
                      }
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
                            <FormMessage className="text-sm text-muted-foreground">
                              Password must be at least 6 characters, include an uppercase letter and a number
                            </FormMessage>
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full" disabled={registerForm.formState.isSubmitting}>
                        {registerForm.formState.isSubmitting ? "Creating account..." : "Create Account"}
                      </Button>
                    </form>
                  </Form>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
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