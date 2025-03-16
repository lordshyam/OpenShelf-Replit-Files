import { createContext, useContext, useEffect, useRef } from 'react';
import { useAuth } from './use-auth';
import { useToast } from './use-toast';
import { queryClient } from '@/lib/queryClient';
import type { Chat } from '@shared/schema';

type WebSocketContextType = {
  send: (message: any) => void;
};

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const wsRef = useRef<WebSocket | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'CREDIT_UPDATE' && data.userId === user?.id) {
          queryClient.setQueryData(["/api/user"], (oldData: any) => ({
            ...oldData,
            credits: data.credits
          }));
        } else if (data.type === 'CHAT_MESSAGE') {
          const chat = data.chat;
          
          // Always update the chat cache regardless of current page
          queryClient.setQueryData(["/api/chats", user?.id], (oldChats: Chat[] | undefined) => {
            if (!oldChats) return [chat];
            return [...oldChats, chat];
          });

          // Show notification for incoming messages
          if (chat.senderId !== user?.id) {
            toast({
              title: "New Message",
              description: data.bookTitle ? `Regarding book: ${data.bookTitle}` : chat.message,
            });
          }
        }
      };

      wsRef.current.onerror = () => {
        toast({
          title: "Connection Error",
          description: "Failed to connect to chat server",
          variant: "destructive",
        });
      };

      wsRef.current.onclose = () => {
        // Attempt to reconnect after 1 second
        setTimeout(connect, 1000);
      };
    }

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [user?.id, toast]);

  const send = (message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      // Queue message to be sent when connection is restored
      toast({
        title: "Connection Lost",
        description: "Trying to reconnect...",
        variant: "destructive",
      });
    }
  };

  return (
    <WebSocketContext.Provider value={{ send }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}
