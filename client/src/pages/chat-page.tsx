import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Chat, BorrowRequest, type Book } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Send, Loader2, Check, X } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";

type ChatRoom = {
  userId: number;
  username: string;
  lastMessage?: string;
  unreadCount: number;
};

export default function ChatPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeChat, setActiveChat] = useState<number | null>(null);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [messages, setMessages] = useState<Chat[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const { data: books } = useQuery<Book[]>({
    queryKey: ["/api/books"],
  });

  const { data: borrowRequests, isLoading: loadingRequests } = useQuery<BorrowRequest[]>({
    queryKey: ["/api/borrow-requests"],
  });

  const { data: chats, isLoading: loadingChats } = useQuery<Chat[]>({
    queryKey: ["/api/chats", user?.id],
  });

  const acceptRequestMutation = useMutation({
    mutationFn: async (requestId: number) => {
      await apiRequest("POST", `/api/borrow-requests/${requestId}/accept`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/borrow-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      toast({
        title: "Success",
        description: "Borrow request accepted",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const declineRequestMutation = useMutation({
    mutationFn: async (requestId: number) => {
      await apiRequest("POST", `/api/borrow-requests/${requestId}/decline`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/borrow-requests"] });
      toast({
        title: "Success",
        description: "Borrow request declined",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (chats) {
      // Group chats by user to create chat rooms
      const rooms = new Map<number, ChatRoom>();
      chats.forEach(chat => {
        const otherUserId = chat.senderId === user?.id ? chat.receiverId : chat.senderId;
        if (!rooms.has(otherUserId)) {
          rooms.set(otherUserId, {
            userId: otherUserId,
            username: `User #${otherUserId}`, // Will be updated with actual username
            lastMessage: chat.message,
            unreadCount: 0
          });
        } else {
          const room = rooms.get(otherUserId)!;
          room.lastMessage = chat.message;
        }
      });
      setChatRooms(Array.from(rooms.values()));
    }
  }, [chats, user?.id]);

  useEffect(() => {
    if (activeChat && chats) {
      // Filter messages for active chat
      const activeMessages = chats.filter(chat => 
        (chat.senderId === user?.id && chat.receiverId === activeChat) ||
        (chat.receiverId === user?.id && chat.senderId === activeChat)
      );
      setMessages(activeMessages);
    }
  }, [activeChat, chats, user?.id]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'CREDIT_UPDATE' && data.userId === user?.id) {
        // Update user credits in real-time
        queryClient.setQueryData(["/api/user"], (oldData: any) => ({
          ...oldData,
          credits: data.credits
        }));
      } else if (data.type === 'CHAT_MESSAGE') {
        // Handle new chat message
        const chat = data.chat;
        setMessages(prev => [...prev, chat]);
        if (data.bookTitle) {
          toast({
            title: "New Message",
            description: `Regarding book: ${data.bookTitle}`,
          });
        }
      } else {
        // Handle regular chat message
        setMessages(prev => [...prev, data]);
      }
    };

    wsRef.current.onerror = () => {
      toast({
        title: "WebSocket Error",
        description: "Failed to connect to chat server",
        variant: "destructive",
      });
    };

    return () => {
      wsRef.current?.close();
    };
  }, [user?.id, toast]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = () => {
    if (!newMessage.trim() || !wsRef.current || !activeChat) return;

    const message = {
      senderId: user!.id,
      receiverId: activeChat,
      message: newMessage,
      timestamp: new Date().toISOString()
    };

    wsRef.current.send(JSON.stringify(message));
    setNewMessage("");
  };

  if (loadingRequests || loadingChats) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const pendingRequests = borrowRequests?.filter(
    req => books?.find(b => b.id === req.bookId)?.ownerId === user?.id && req.status === "pending"
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="h-[calc(100vh-8rem)]">
        <CardHeader>
          <CardTitle>Messages</CardTitle>
          {pendingRequests && pendingRequests.length > 0 && (
            <div className="space-y-4 mt-4 bg-muted p-4 rounded-lg">
              <h3 className="font-semibold">Pending Borrow Requests</h3>
              {pendingRequests.map(request => {
                const book = books?.find(b => b.id === request.bookId);
                return (
                  <div key={request.id} className="flex items-center justify-between bg-background p-3 rounded-md">
                    <div>
                      <p className="font-medium">{book?.title}</p>
                      <p className="text-sm text-muted-foreground">Request from user #{request.requesterId}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => acceptRequestMutation.mutate(request.id)}
                        disabled={acceptRequestMutation.isPending}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => declineRequestMutation.mutate(request.id)}
                        disabled={declineRequestMutation.isPending}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Decline
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardHeader>
        <CardContent className="flex h-full gap-4">
          {/* Chat rooms list */}
          <div className="w-64 border-r">
            {chatRooms.map(room => (
              <div
                key={room.userId}
                className={`p-3 cursor-pointer hover:bg-accent ${
                  activeChat === room.userId ? 'bg-accent' : ''
                }`}
                onClick={() => setActiveChat(room.userId)}
              >
                <div className="font-medium">{room.username}</div>
                {room.lastMessage && (
                  <div className="text-sm text-muted-foreground truncate">
                    {room.lastMessage}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Chat messages */}
          <div className="flex-1 flex flex-col">
            {activeChat ? (
              <>
                <ScrollArea ref={scrollRef} className="flex-1 pr-4">
                  <div className="space-y-4">
                    {messages.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex ${msg.senderId === user!.id ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg px-4 py-2 ${
                            msg.senderId === user!.id
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          <p className="text-sm">{msg.message}</p>
                          <span className="text-xs opacity-70">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <div className="flex items-center space-x-2 mt-4">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..."
                    onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                  />
                  <Button onClick={sendMessage} disabled={!newMessage.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Select a chat to start messaging
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}