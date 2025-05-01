import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { WebSocketProvider } from "@/hooks/use-websocket";
import { ProtectedRoute } from "./lib/protected-route";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import HomePage from "@/pages/home-page";
import MyLibrary from "@/pages/my-library";
import ChatPage from "@/pages/chat-page";
import CommunitySelection from "@/pages/community-selection";
import CommunityManagement from "@/pages/community-management";
import AdminPage from "@/pages/admin-page";
import LocationSetupPage from "@/pages/location-setup-page";
import Navbar from "@/components/ui/navbar";

// This component ensures users have selected their location before accessing protected content
const LocationAwareProtectedRoute = ({ component: Component, ...rest }: any) => {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  
  // First, check if authenticated using the existing ProtectedRoute
  return (
    <ProtectedRoute
      {...rest}
      component={(props: any) => {
        // If authenticated but location not verified, redirect to location setup
        if (user && !isLoading && !user.locationVerified) {
          navigate("/location-setup");
          return null;
        }
        
        // Otherwise, render the protected component
        return <Component {...props} />;
      }}
    />
  );
};

function Router() {
  const [location] = useLocation();
  
  // Create a route change listener to maintain data consistency
  useEffect(() => {
    // Refetch key data on route changes to ensure fresh data
    // User data
    queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    
    // Route-specific data
    if (location === "/") {
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
    } else if (location === "/library") {
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
    } else if (location === "/chat") {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/community-chats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    } else if (location === "/community-management") {
      queryClient.invalidateQueries({ queryKey: ["/api/communities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/community-join-requests"] });
    }
  }, [location]);
  
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Switch>
        <Route path="/auth" component={AuthPage} />
        <Route path="/select-community" component={CommunitySelection} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/location-setup" component={LocationSetupPage} />
        <LocationAwareProtectedRoute path="/" component={HomePage} />
        <LocationAwareProtectedRoute path="/library" component={MyLibrary} />
        <LocationAwareProtectedRoute path="/chat" component={ChatPage} />
        <LocationAwareProtectedRoute path="/community-management" component={CommunityManagement} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WebSocketProvider>
          <Router />
          <Toaster />
        </WebSocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;