import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "./button";
import { Avatar, AvatarImage, AvatarFallback } from "./avatar";
import { HomeIcon, BookOpen, MessageSquare } from "lucide-react";

export default function Navbar() {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();

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
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">Credits:</span>
            <span className="font-medium">{user.credits}</span>
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