import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";
import { WebSocketProvider } from "@/hooks/use-websocket";
import { ProtectedRoute } from "./lib/protected-route";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import HomePage from "@/pages/home-page";
import MyLibrary from "@/pages/my-library";
import ChatPage from "@/pages/chat-page";
import CommunitySelection from "@/pages/community-selection";
import Navbar from "@/components/ui/navbar";

function Router() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Switch>
        <Route path="/auth" component={AuthPage} />
        <Route path="/select-community" component={CommunitySelection} />
        <ProtectedRoute path="/" component={HomePage} />
        <ProtectedRoute path="/library" component={MyLibrary} />
        <ProtectedRoute path="/chat" component={ChatPage} />
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