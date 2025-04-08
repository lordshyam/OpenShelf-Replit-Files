import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "./button";
import { Avatar, AvatarImage, AvatarFallback } from "./avatar";
import { HomeIcon, BookOpen, MessageSquare, Settings, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { formatCredits } from "@/lib/format-credits";

export default function Navbar() {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();
  
  // Check if user is a community admin
  const { data: community } = useQuery({
    queryKey: ["/api/communities", user?.communityId],
    enabled: !!user?.communityId,
    queryFn: async () => {
      const res = await fetch(`/api/communities/${user!.communityId}`);
      if (!res.ok) return null;
      return res.json();
    }
  });
  
  const isAdmin = community && user && community.createdBy === user.id;

  if (!user) return null;

  return (
    <nav className="border-b bg-card">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <Link href="/">
            <a className="font-bold text-lg text-primary">OpenShelf</a>
          </Link>

          <div className="flex items-center space-x-4">
            <Link href="/">
              <a className={`flex items-center space-x-2 ${location === "/" ? "text-primary" : "text-muted-foreground"}`}>
                <HomeIcon className="h-5 w-5" />
                <span>Home</span>
              </a>
            </Link>

            <Link href="/library">
              <a className={`flex items-center space-x-2 ${location === "/library" ? "text-primary" : "text-muted-foreground"}`}>
                <BookOpen className="h-5 w-5" />
                <span>My Library</span>
              </a>
            </Link>

            <Link href="/chat">
              <a className={`flex items-center space-x-2 ${location === "/chat" ? "text-primary" : "text-muted-foreground"}`}>
                <MessageSquare className="h-5 w-5" />
                <span>Chat</span>
              </a>
            </Link>
            
            {isAdmin && (
              <Link href="/community-management">
                <a className={`flex items-center space-x-2 ${location === "/community-management" ? "text-primary" : "text-muted-foreground"}`}>
                  <Settings className="h-5 w-5" />
                  <span>Manage Community</span>
                </a>
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">Credits:</span>
            <span className="font-medium">{formatCredits(user.credits).toFixed(1)}</span>
          </div>

          <Avatar>
            {user.avatar ? (
              <AvatarImage src={`data:image/svg+xml;base64,${btoa(user.avatar)}`} alt={user.username} />
            ) : (
              <AvatarFallback>{user.username[0].toUpperCase()}</AvatarFallback>
            )}
          </Avatar>

          <Button variant="outline" onClick={() => logoutMutation.mutate()}>
            Logout
          </Button>
        </div>
      </div>
    </nav>
  );
}