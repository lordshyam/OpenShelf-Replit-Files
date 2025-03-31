import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCommunitySchema, type Community } from "@shared/schema";
import { Search, PlusCircle, Users, Building, ArrowRight, Upload, Camera, X, Lock, Globe } from "lucide-react";
import { useState } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export default function CommunitySelection() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(insertCommunitySchema),
    defaultValues: {
      name: "",
      description: "",
      location: "",
      imageUrl: "",
      isPublic: true,
      createdBy: user?.id,
    },
  });
  
  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Image too large",
        description: "Please choose an image under 5MB",
        variant: "destructive",
      });
      return;
    }

    // Only accept image files
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file (JPEG, PNG, etc.)",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    form.setValue("imageUrl", await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    }));
  };

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
                <Card key={community.id} className="hover:shadow-lg transition-shadow overflow-hidden">
                  {community.imageUrl && (
                    <div className="w-full h-48">
                      <img 
                        src={community.imageUrl} 
                        alt={community.name} 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="flex items-center gap-2">
                        <Building className="h-5 w-5" />
                        {community.name}
                      </CardTitle>
                      <Badge variant={community.isPublic ? "default" : "outline"} className="flex items-center gap-1">
                        {community.isPublic ? (
                          <>
                            <Globe className="w-3 h-3" />
                            Public
                          </>
                        ) : (
                          <>
                            <Lock className="w-3 h-3" />
                            Private
                          </>
                        )}
                      </Badge>
                    </div>
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

                  <FormField
                    control={form.control}
                    name="isPublic"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            {field.value ? (
                              <span className="flex items-center">
                                <Globe className="w-4 h-4 mr-2" />
                                Public Community
                              </span>
                            ) : (
                              <span className="flex items-center">
                                <Lock className="w-4 h-4 mr-2" />
                                Private Community
                              </span>
                            )}
                          </FormLabel>
                          <FormDescription>
                            {field.value 
                              ? "Anyone can view and join this community" 
                              : "Join requests need to be approved by you"}
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <div className="space-y-4">
                    <FormLabel>Community Image</FormLabel>
                    {imagePreview && (
                      <div className="relative w-full h-48 rounded-lg overflow-hidden">
                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() => {
                            setImagePreview(null);
                            form.setValue("imageUrl", "");
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageCapture}
                          className="hidden"
                          id="image-upload"
                        />
                        <label htmlFor="image-upload">
                          <Button type="button" variant="outline" className="w-full" asChild>
                            <span>
                              <Upload className="mr-2 h-4 w-4" />
                              Upload Image
                            </span>
                          </Button>
                        </label>
                      </div>
                      {/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && (
                        <div>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleImageCapture}
                            className="hidden"
                            id="camera-capture"
                          />
                          <label htmlFor="camera-capture">
                            <Button type="button" variant="outline" className="w-full" asChild>
                              <span>
                                <Camera className="mr-2 h-4 w-4" />
                                Take Photo
                              </span>
                            </Button>
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setShowCreateForm(false);
                        setImagePreview(null);
                        form.reset();
                      }}
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