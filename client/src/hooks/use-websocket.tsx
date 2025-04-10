import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './use-auth';
import { useToast } from './use-toast';
import { ToastAction } from '@/components/ui/toast';
import { queryClient } from '@/lib/queryClient';
import type { Chat, CommunityChat, Book } from '@shared/schema';

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
          
          // After reconnection, refresh critical data
          if (user?.id) {
            // Invalidate key queries to ensure data is refreshed
            queryClient.invalidateQueries({ queryKey: ["/api/user"] });
            queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
            queryClient.invalidateQueries({ queryKey: ["/api/books"] });
            
            if (user.communityId) {
              queryClient.invalidateQueries({ queryKey: ["/api/community-chats"] });
            }
          }
          
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
              
            case 'BORROW_REQUEST_NOTIFICATION':
              // Show notification for book owner
              if (user?.id) {
                // Create a toast notification that redirects to the My Library -> Borrow Requests tab
                toast({
                  title: "New Borrow Request",
                  description: data.message,
                  action: (
                    <ToastAction altText="View Request" onClick={() => {
                      // Store the active tab in sessionStorage
                      sessionStorage.setItem('openMyLibraryTab', 'requests');
                      // Navigate to My Library
                      window.location.href = '/my-library';
                    }}>
                      View Request
                    </ToastAction>
                  ),
                });
                
                // Invalidate borrow requests to make sure they're up to date
                queryClient.invalidateQueries({ queryKey: ["/api/borrow-requests", user.id] });
              }
              break;

            case 'CHAT_MESSAGE':
              const chat = data.chat as Chat;
              
              // Make a copy of the chat to ensure it's properly serialized
              const chatToStore = { ...chat };
              
              // Ensure we update the React Query cache with the received message
              queryClient.setQueryData(["/api/chats", user?.id], (oldChats: Chat[] | undefined) => {
                if (!oldChats) return [chatToStore];
                
                // Check for duplicates to avoid adding the same message twice
                const isDuplicate = oldChats.some(
                  c => c.id === chatToStore.id || 
                      (c.senderId === chatToStore.senderId && 
                       c.receiverId === chatToStore.receiverId &&
                       c.message === chatToStore.message && 
                       Math.abs(new Date(c.timestamp).getTime() - new Date(chatToStore.timestamp).getTime()) < 1000)
                );
                
                if (isDuplicate) return oldChats;
                return [...oldChats, chatToStore];
              });

              // Special handling for system messages from OpenShelf
              if (data.systemMessage && chat.senderId === 0) {
                toast({
                  title: "OpenShelf Notification",
                  description: data.bookTitle ? `About book "${data.bookTitle}": ${chat.message}` : chat.message,
                });
              } 
              // Regular user messages - only show notifications for messages from others
              else if (chat.senderId !== user?.id) {
                toast({
                  title: "New Message",
                  description: data.bookTitle ? `Regarding book: ${data.bookTitle}` : chat.message,
                });
              }
              break;

            case 'COMMUNITY_CHAT':
              console.log('Received community chat message:', data);
              const communityChat = data.chat as CommunityChat;
              
              // Make a copy to ensure it's properly serialized
              const communityChatToStore = { ...communityChat };
              
              // Get additional data if this is a book listing message
              if (data.book) {
                // Update books query to include the new book if not already there
                queryClient.setQueryData(["/api/books"], (oldBooks: Book[] | undefined) => {
                  if (!oldBooks) return [data.book];
                  
                  // Don't add duplicate books
                  const isDuplicateBook = oldBooks.some(b => b.id === data.book.id);
                  if (isDuplicateBook) return oldBooks;
                  
                  return [...oldBooks, data.book];
                });
              }
              
              // Only process if we have user data
              if (user) {
                // Only update the UI if the user belongs to this community
                if (user.communityId === communityChatToStore.communityId) {
                  // Store the message in the query cache
                  queryClient.setQueryData(["/api/community-chats", communityChatToStore.communityId], 
                    (oldChats: CommunityChat[] | undefined) => {
                      if (!oldChats) return [communityChatToStore];
                      
                      // Don't add duplicate messages (can happen if server broadcasts to all)
                      const isDuplicate = oldChats.some(
                        c => c.id === communityChatToStore.id || 
                            (c.userId === communityChatToStore.userId && 
                             c.message === communityChatToStore.message && 
                             Math.abs(new Date(c.timestamp).getTime() - new Date(communityChatToStore.timestamp).getTime()) < 1000)
                      );
                      
                      if (isDuplicate) return oldChats;
                      
                      // Add message to cache, ensuring proper sort order
                      const updatedChats = [...oldChats, communityChatToStore]
                        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                      
                      return updatedChats;
                    }
                  );

                  // Show toast notification for messages from others
                  if (communityChat.userId !== user.id) {
                    toast({
                      title: `New message in ${data.communityName}`,
                      description: communityChat.message.length > 50 
                        ? communityChat.message.substring(0, 50) + '...' 
                        : communityChat.message,
                    });
                  }
                }
              }
              break;
            
            case 'COMMUNITY_CHAT_CONFIRMED':
              console.log('Community chat message confirmed:', data.chatId);
              // Add our own message to the community chat list
              if (user) {
                const confirmChat = {
                  id: data.chatId,
                  userId: user.id,
                  communityId: user.communityId!,
                  message: data.message || "",
                  timestamp: new Date()
                };
                
                queryClient.setQueryData(["/api/community-chats", user.communityId], 
                  (oldChats: CommunityChat[] | undefined) => {
                    if (!oldChats) return [confirmChat];
                    
                    // Don't add duplicate messages
                    const isDuplicate = oldChats.some(
                      c => c.id === confirmChat.id || 
                          (c.userId === confirmChat.userId && 
                           c.message === confirmChat.message && 
                           Math.abs(new Date(c.timestamp).getTime() - new Date(confirmChat.timestamp).getTime()) < 5000)
                    );
                    
                    if (isDuplicate) return oldChats;
                    
                    // Add message to cache, ensuring proper sort order
                    const updatedChats = [...oldChats, confirmChat]
                      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                    
                    return updatedChats;
                  }
                );
              }
              break;
            
            case 'CHAT_MESSAGE_CONFIRMED':
              console.log('Private chat message confirmed:', data.chat.id);
              // Update the local chat list with the confirmed message
              const confirmedChat = data.chat as Chat;
              queryClient.setQueryData(["/api/chats", user?.id], (oldChats: Chat[] | undefined) => {
                if (!oldChats) return [confirmedChat];
                
                // Don't add duplicate messages
                const isDuplicate = oldChats.some(
                  c => c.id === confirmedChat.id || 
                      (c.senderId === confirmedChat.senderId && 
                       c.receiverId === confirmedChat.receiverId &&
                       c.message === confirmedChat.message && 
                       Math.abs(new Date(c.timestamp).getTime() - new Date(confirmedChat.timestamp).getTime()) < 1000)
                );
                
                if (isDuplicate) return oldChats;
                
                // Add message to cache, ensuring proper sort order
                const updatedChats = [...oldChats, confirmedChat]
                  .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                
                return updatedChats;
              });
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
          
          // Don't show too many reconnection toasts
          if (!reconnectTimeoutRef.current) {
            toast({
              title: "Connection Error",
              description: "Failed to connect to chat server. Reconnecting...",
              variant: "destructive",
            });
          }
          
          // Attempt reconnection on error
          if (wsRef.current) {
            try {
              wsRef.current.close();
            } catch (e) {
              // Ignore close errors
            }
          }
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
      // If we're not connected, force a reconnection attempt
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch (e) {
          // Ignore close errors
        }
      }
      
      // Clear existing timeout and restart connection immediately
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = undefined;
      }
      
      toast({
        title: "Connection Lost",
        description: "Reconnecting and will try to send your message again...",
        variant: "destructive",
      });
      
      // Store the message to try sending again after reconnection
      // This could be enhanced with a proper message queue if needed
      const storedMessage = message;
      
      setTimeout(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          try {
            wsRef.current.send(JSON.stringify(storedMessage));
          } catch (error) {
            console.error('Error resending message after reconnection:', error);
          }
        }
      }, 3000); // Try resending after 3 seconds
      
      return;
    }

    try {
      wsRef.current.send(JSON.stringify(message));
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
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