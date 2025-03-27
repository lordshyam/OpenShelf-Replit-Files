import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './use-auth';
import { useToast } from './use-toast';
import { queryClient } from '@/lib/queryClient';
import type { Chat, CommunityChat } from '@shared/schema';

type WebSocketContextType = {
  send: (message: any) => void;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
};

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const wsRef = useRef<WebSocket | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');

  useEffect(() => {
    function connect() {
      try {
        setConnectionStatus('connecting');
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        // Include credentials with the WebSocket connection
        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          console.log('WebSocket connected');
          setConnectionStatus('connected');
          toast({
            title: "Connected",
            description: "Chat connection established",
          });
        };

        wsRef.current.onmessage = (event) => {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case 'CREDIT_UPDATE':
              if (data.userId === user?.id) {
                queryClient.setQueryData(["/api/user"], (oldData: any) => ({
                  ...oldData,
                  credits: data.credits
                }));
              }
              break;

            case 'CHAT_MESSAGE':
              const chat = data.chat as Chat;
              queryClient.setQueryData(["/api/chats", user?.id], (oldChats: Chat[] | undefined) => {
                if (!oldChats) return [chat];
                return [...oldChats, chat];
              });

              if (chat.senderId !== user?.id) {
                toast({
                  title: "New Message",
                  description: data.bookTitle ? `Regarding book: ${data.bookTitle}` : chat.message,
                });
              }
              break;

            case 'COMMUNITY_CHAT':
              const communityChat = data.chat as CommunityChat;
              queryClient.setQueryData(["/api/community-chats", communityChat.communityId], 
                (oldChats: CommunityChat[] | undefined) => {
                  if (!oldChats) return [communityChat];
                  return [...oldChats, communityChat];
                }
              );

              if (communityChat.userId !== user?.id) {
                toast({
                  title: `New message in ${data.communityName}`,
                  description: communityChat.message,
                });
              }
              break;

            case 'CONNECTION_STATUS':
              setConnectionStatus(data.status === 'connected' ? 'connected' : 'disconnected');
              break;

            case 'ERROR':
              toast({
                title: "Chat Error",
                description: data.message,
                variant: "destructive",
              });
              break;
          }
        };

        wsRef.current.onerror = (error) => {
          console.error('WebSocket error:', error);
          setConnectionStatus('disconnected');
          toast({
            title: "Connection Error",
            description: "Failed to connect to chat server",
            variant: "destructive",
          });
        };

        wsRef.current.onclose = () => {
          console.log('WebSocket closed, attempting to reconnect...');
          setConnectionStatus('disconnected');
          // Clear any existing timeout
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          // Attempt to reconnect after 2 seconds
          reconnectTimeoutRef.current = setTimeout(connect, 2000);
        };
      } catch (error) {
        console.error('WebSocket connection error:', error);
        setConnectionStatus('disconnected');
      }
    }

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [user?.id, toast]);

  const send = (message: any) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      toast({
        title: "Connection Lost",
        description: "Trying to reconnect...",
        variant: "destructive",
      });
      return;
    }

    try {
      wsRef.current.send(JSON.stringify(message));
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    }
  };

  return (
    <WebSocketContext.Provider value={{ send, connectionStatus }}>
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