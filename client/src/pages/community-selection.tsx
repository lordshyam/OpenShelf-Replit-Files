import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCommunitySchema, type Community } from "@shared/schema";
import { Search, PlusCircle, Users, Building, ArrowRight } from "lucide-react";
import { useState } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";

export default function CommunitySelection() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const form = useForm({
    resolver: zodResolver(insertCommunitySchema),
    defaultValues: {
      name: "",
      description: "",
      location: "",
      createdBy: user?.id,
    },
  });

  const { data: communities, isLoading } = useQuery<Community[]>({
    queryKey: ["/api/communities"],
    select: (communities) => communities.filter(c =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.location.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  });

  const createCommunityMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/communities", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/communities"] });
      toast({
        title: "Success",
        description: "Community created successfully",
      });
      setShowCreateForm(false);
      joinCommunityMutation.mutate(data.id);
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating community",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const joinCommunityMutation = useMutation({
    mutationFn: async (communityId: number) => {
      const res = await apiRequest("POST", `/api/communities/${communityId}/join`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setLocation("/");
      toast({
        title: "Success",
        description: "Joined community successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error joining community",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSkip = () => {
    sessionStorage.setItem('skipCommunity', 'true');
    toast({
      title: "Welcome to OpenShelf!",
      description: "You can join a community anytime from your profile settings.",
    });
    setLocation("/");
  };

  if (!user) {
    setLocation("/auth");
    return null;
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Welcome to OpenShelf</h1>
          <p className="text-muted-foreground">
            Join your local community to start sharing and borrowing books, or skip for now and explore the platform
          </p>
        </div>

        {!showCreateForm ? (
          <>
            <div className="flex justify-center gap-4 mb-8">
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleSkip}
              >
                Skip for Now
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="relative max-w-xl mx-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search communities by name or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {communities?.map((community) => (
                <Card key={community.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      {community.name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{community.location}</p>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm mb-4">{community.description}</p>
                    <Button
                      className="w-full"
                      onClick={() => joinCommunityMutation.mutate(community.id)}
                      disabled={joinCommunityMutation.isPending}
                    >
                      <Users className="mr-2 h-4 w-4" />
                      Join Community
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="text-center">
              <Button
                variant="outline"
                onClick={() => setShowCreateForm(true)}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Create New Community
              </Button>
            </div>
          </>
        ) : (
          <Card className="max-w-xl mx-auto">
            <CardHeader>
              <CardTitle>Create New Community</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((data) => createCommunityMutation.mutate(data))} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Community Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Enter community name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Enter community location" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Describe your community" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowCreateForm(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={createCommunityMutation.isPending}
                    >
                      {createCommunityMutation.isPending ? "Creating..." : "Create Community"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}