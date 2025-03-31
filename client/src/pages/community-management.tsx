import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Users, 
  Lock, 
  Globe, 
  MessageSquare, 
  Compass, 
  UserPlus, 
  Check, 
  X, 
  MoreHorizontal, 
  LogOut, 
  Settings 
} from "lucide-react";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState, useEffect } from "react";
import { type Community, type CommunityJoinRequest, type User } from "@shared/schema";

export default function CommunityManagement() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("members");

  // Redirect if not logged in
  if (!user) {
    setLocation("/auth");
    return (
      <div className="container mx-auto py-8 px-4">
        <p>Redirecting to login...</p>
      </div>
    );
  }
  
  // Get the user's current community
  const { data: community, isLoading: isCommunityLoading } = useQuery<Community>({
    queryKey: ["/api/communities", user.communityId],
    enabled: !!user.communityId,
    queryFn: async () => {
      const res = await fetch(`/api/communities/${user.communityId}`);
      if (!res.ok) throw new Error("Failed to fetch community");
      return res.json();
    },
  });
  
  // Check if the user is the community admin (creator)
  const isAdmin = community?.createdBy === user.id;
  
  // If not admin, redirect to home
  useEffect(() => {
    if (community && !isAdmin) {
      toast({
        title: "Access Denied",
        description: "Only community admins can access this page",
        variant: "destructive",
      });
      setLocation("/");
    }
  }, [community, isAdmin, setLocation, toast]);
  
  // Get community members
  const { data: members, isLoading: isMembersLoading } = useQuery<User[]>({
    queryKey: ["/api/communities", user.communityId, "members"],
    enabled: !!user.communityId,
    queryFn: async () => {
      const res = await fetch(`/api/communities/${user.communityId}/members`);
      if (!res.ok) throw new Error("Failed to fetch members");
      return res.json();
    },
  });
  
  // Get join requests
  const { data: joinRequests, isLoading: isRequestsLoading } = useQuery<CommunityJoinRequest[]>({
    queryKey: ["/api/communities", user.communityId, "join-requests"],
    enabled: !!user.communityId && isAdmin,
    queryFn: async () => {
      const res = await fetch(`/api/communities/${user.communityId}/join-requests`);
      if (!res.ok) throw new Error("Failed to fetch join requests");
      return res.json();
    },
  });
  
  // Mutations for accepting and declining join requests
  const acceptRequestMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const res = await apiRequest(
        "POST", 
        `/api/communities/${user.communityId}/join-requests/${requestId}/accept`
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/communities", user.communityId, "join-requests"] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/communities", user.communityId, "members"] 
      });
      toast({
        title: "Success",
        description: "User has been accepted to your community",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error accepting request",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const declineRequestMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const res = await apiRequest(
        "POST", 
        `/api/communities/${user.communityId}/join-requests/${requestId}/decline`
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/communities", user.communityId, "join-requests"] 
      });
      toast({
        title: "Success",
        description: "User's request has been declined",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error declining request",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Toggle community public/private status
  const toggleVisibilityMutation = useMutation({
    mutationFn: async () => {
      if (!community) return;
      const res = await apiRequest(
        "PATCH", 
        `/api/communities/${user.communityId}`,
        { isPublic: !community.isPublic }
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/communities", user.communityId] 
      });
      toast({
        title: "Success",
        description: `Community is now ${community?.isPublic ? "private" : "public"}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating community",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Remove member from community
  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: number) => {
      const res = await apiRequest(
        "POST", 
        `/api/communities/${user.communityId}/remove-member`,
        { userId: memberId }
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/communities", user.communityId, "members"] 
      });
      toast({
        title: "Success",
        description: "Member has been removed from the community",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error removing member",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Leave community
  const leaveCommunityMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "POST", 
        `/api/communities/${user.communityId}/leave`
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setLocation("/community-selection");
      toast({
        title: "Success",
        description: "You have left the community",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error leaving community",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Loading state
  if (isCommunityLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading community information...</p>
        </div>
      </div>
    );
  }

  // No community state
  if (!community) {
    return (
      <div className="container max-w-4xl mx-auto py-12">
        <Card>
          <CardHeader>
            <CardTitle>No Community</CardTitle>
            <CardDescription>You are not part of any community.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => setLocation("/community-selection")}>
              <Compass className="mr-2 h-4 w-4" />
              Find Communities
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Not admin state
  if (!isAdmin) {
    return (
      <div className="container mx-auto py-8 px-4">
        <p>Checking permissions...</p>
      </div>
    ); // This will redirect via the useEffect
  }

  // Calculate pending request count
  const pendingRequestsCount = joinRequests?.filter(r => r.status === "pending").length || 0;

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl">{community.name}</CardTitle>
              <CardDescription>{community.location}</CardDescription>
            </div>
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
        </CardHeader>
        <CardContent>
          <p className="text-sm mb-4">{community.description}</p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant={community.isPublic ? "outline" : "default"}
              size="sm"
              onClick={() => toggleVisibilityMutation.mutate()}
              disabled={toggleVisibilityMutation.isPending}
            >
              {community.isPublic ? (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Make Private
                </>
              ) : (
                <>
                  <Globe className="mr-2 h-4 w-4" />
                  Make Public
                </>
              )}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation(`/community-chat/${community.id}`)}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Community Chat
            </Button>
            
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (confirm("Are you sure you want to leave this community? As the creator, this will delete the community.")) {
                  leaveCommunityMutation.mutate();
                }
              }}
              disabled={leaveCommunityMutation.isPending}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {leaveCommunityMutation.isPending ? "Leaving..." : "Leave Community"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4 grid w-full grid-cols-2">
          <TabsTrigger value="members">
            <Users className="mr-2 h-4 w-4" />
            Members ({members?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="requests" className="relative">
            <UserPlus className="mr-2 h-4 w-4" />
            Join Requests
            {pendingRequestsCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full w-5 h-5 text-xs flex items-center justify-center">
                {pendingRequestsCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle>Community Members</CardTitle>
              <CardDescription>
                Manage members of your community
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isMembersLoading ? (
                <div className="flex justify-center p-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : members && members.length > 0 ? (
                <div className="space-y-3">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          {member.avatar ? (
                            <img src={member.avatar} alt={member.username} />
                          ) : (
                            <div className="bg-primary text-primary-foreground w-full h-full flex items-center justify-center text-lg font-semibold">
                              {member.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </Avatar>
                        <div>
                          <p className="font-medium">{member.username}</p>
                          <p className="text-sm text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                      <div>
                        {member.id === user.id ? (
                          <Badge>Admin</Badge>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuGroup>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => {
                                    if (confirm(`Are you sure you want to remove ${member.username} from the community?`)) {
                                      removeMemberMutation.mutate(member.id);
                                    }
                                  }}
                                >
                                  <X className="mr-2 h-4 w-4" />
                                  Remove from community
                                </DropdownMenuItem>
                              </DropdownMenuGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No members found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="requests">
          <Card>
            <CardHeader>
              <CardTitle>Join Requests</CardTitle>
              <CardDescription>
                Review and manage requests to join your community
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isRequestsLoading ? (
                <div className="flex justify-center p-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : joinRequests && joinRequests.filter(r => r.status === "pending").length > 0 ? (
                <div className="space-y-3">
                  {joinRequests
                    .filter(r => r.status === "pending")
                    .map((request) => {
                      const requester = members?.find(m => m.id === request.userId);
                      return (
                        <div key={request.id} className="flex items-center justify-between p-3 rounded-lg border">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              {requester?.avatar ? (
                                <img src={requester.avatar} alt={requester.username} />
                              ) : (
                                <div className="bg-primary/10 text-primary w-full h-full flex items-center justify-center text-lg font-semibold">
                                  {requester?.username.charAt(0).toUpperCase() || "?"}
                                </div>
                              )}
                            </Avatar>
                            <div>
                              <p className="font-medium">{requester?.username || `User ${request.userId}`}</p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(request.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex items-center gap-1"
                              onClick={() => acceptRequestMutation.mutate(request.id)}
                              disabled={acceptRequestMutation.isPending}
                            >
                              <Check className="h-4 w-4" />
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex items-center gap-1 border-destructive text-destructive hover:bg-destructive/10"
                              onClick={() => declineRequestMutation.mutate(request.id)}
                              disabled={declineRequestMutation.isPending}
                            >
                              <X className="h-4 w-4" />
                              Decline
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No pending join requests</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}