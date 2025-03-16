import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, verifyEmailSchema, type InsertUser } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "wouter";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { BookOpen } from "lucide-react";

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [pendingVerification, setPendingVerification] = useState<string | null>(null);

  if (user) {
    setLocation("/");
    return null;
  }

  const loginForm = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema.omit({ email: true })),
    defaultValues: { username: "", password: "" },
  });

  const registerForm = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: { username: "", email: "", password: "" },
  });

  const verificationForm = useForm({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: { email: "", code: "" },
  });

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

      const user = await res.json();
      toast({
        title: "Success!",
        description: "Email verified successfully. Welcome to OpenShelf!",
      });
      setLocation("/");
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
                    <Button type="submit" className="w-full">
                      Verify Email
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
                              <Input {...field} />
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
                              <Input type="password" {...field} />
                            </FormControl>
                            <FormMessage />
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
                            description: "Please check your email for the verification code.",
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
                              <Input {...field} />
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
                              <Input type="email" {...field} />
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
                              <Input type="password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
                        {registerMutation.isPending ? "Creating account..." : "Create Account"}
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