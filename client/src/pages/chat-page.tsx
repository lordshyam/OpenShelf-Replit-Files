import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useWebSocket } from "@/hooks/use-websocket";
import { useQuery } from "@tanstack/react-query";
import { type Chat, type Book, type CommunityChat, type Community } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Send, Loader2, BookOpen } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ChatRoom = {
  userId: number;
  username: string;
  lastMessage?: string;
  bookId?: number | undefined;
  bookTitle?: string;
};

export default function ChatPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { send, connectionStatus } = useWebSocket();
  const [activeChat, setActiveChat] = useState<number | undefined>(undefined);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [messages, setMessages] = useState<Chat[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [communityMessage, setCommunityMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const communityScrollRef = useRef<HTMLDivElement>(null);

  const { data: books } = useQuery<Book[]>({
    queryKey: ["/api/books"],
  });

  const { data: chats, isLoading: loadingChats } = useQuery<Chat[]>({
    queryKey: ["/api/chats", user?.id],
  });

  const { data: communityChats, isLoading: loadingCommunityChats } = useQuery<CommunityChat[]>({
    queryKey: ["/api/community-chats", user?.communityId],
    enabled: !!user?.communityId,
  });
  
  // Get community data
  const { data: communities } = useQuery<Community[]>({
    queryKey: ["/api/communities"],
  });

  useEffect(() => {
    if (chats && books) {
      const rooms = new Map<number, ChatRoom>();
      for (const chat of chats) {
        const otherUserId = chat.senderId === user?.id ? chat.receiverId : chat.senderId;
        const book = chat.bookId ? books.find(b => b.id === chat.bookId) : undefined;

        if (!rooms.has(otherUserId)) {
          rooms.set(otherUserId, {
            userId: otherUserId,
            username: `User #${otherUserId}`,
            lastMessage: chat.message,
            bookId: chat.bookId ?? undefined, 
            bookTitle: book?.title
          });
        } else {
          const room = rooms.get(otherUserId)!;
          room.lastMessage = chat.message;
          if (!room.bookId && chat.bookId) {
            room.bookId = chat.bookId;
            room.bookTitle = book?.title;
          }
        }
      }
      setChatRooms(Array.from(rooms.values()));
    }
  }, [chats, books, user?.id]);

  useEffect(() => {
    if (activeChat && chats) {
      const activeMessages = chats.filter(chat =>
        (chat.senderId === user?.id && chat.receiverId === activeChat) ||
        (chat.receiverId === user?.id && chat.senderId === activeChat)
      );
      setMessages(activeMessages);
    }
  }, [activeChat, chats, user?.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (communityScrollRef.current) {
      communityScrollRef.current.scrollTop = communityScrollRef.current.scrollHeight;
    }
  }, [communityChats]);

  const sendMessage = () => {
    if (!newMessage.trim() || !activeChat) return;

    send({
      senderId: user!.id,
      receiverId: activeChat,
      message: newMessage,
      bookId: chatRooms.find(room => room.userId === activeChat)?.bookId
    });

    setNewMessage("");
  };

  const sendCommunityMessage = () => {
    if (!communityMessage.trim() || !user?.communityId) return;
    
    // Find the community name
    const userCommunity = communities?.find(c => c.id === user.communityId);
    
    send({
      type: 'COMMUNITY_MESSAGE',
      communityId: user.communityId,
      userId: user.id,
      message: communityMessage,
      communityName: userCommunity?.name || 'Community'
    });

    setCommunityMessage("");
  };

  if (loadingChats || loadingCommunityChats) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="h-[calc(100vh-8rem)]">
        <CardHeader>
          <CardTitle>Messages</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="private">
            <TabsList>
              <TabsTrigger value="private">Private Chats</TabsTrigger>
              <TabsTrigger value="community">Community Chat</TabsTrigger>
            </TabsList>

            <div className="mt-4 h-[calc(100vh-16rem)]">
              <TabsContent value="private" className="h-full">
                <div className="flex h-full gap-4">
                  <div className="w-64 border-r overflow-y-auto">
                    {chatRooms.map(room => (
                      <div
                        key={room.userId}
                        className={`p-3 cursor-pointer hover:bg-accent ${
                          activeChat === room.userId ? 'bg-accent' : ''
                        }`}
                        onClick={() => setActiveChat(room.userId)}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                            {room.username.charAt(0).toUpperCase()}
                          </div>
                          <div className="font-medium">{room.username}</div>
                        </div>
                        {room.bookTitle && (
                          <div className="flex items-center text-xs text-primary gap-1 mb-1 ml-10">
                            <BookOpen className="h-3 w-3" />
                            <span>{room.bookTitle}</span>
                          </div>
                        )}
                        {room.lastMessage && (
                          <div className="text-sm text-muted-foreground truncate ml-10">
                            {room.lastMessage}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex-1 flex flex-col">
                    {activeChat ? (
                      <>
                        <div ref={scrollRef} className="flex-1 overflow-y-auto pr-4">
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
                        </div>

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
                </div>
              </TabsContent>

              <TabsContent value="community" className="h-full">
                <div className="flex flex-col h-full">
                  <div ref={communityScrollRef} className="flex-1 overflow-y-auto pr-4">
                    <div className="space-y-4">
                      {communityChats?.map((msg, i) => (
                        <div
                          key={i}
                          className={`flex ${msg.userId === user!.id ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-lg px-4 py-2 ${
                              msg.userId === user!.id
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
                  </div>

                  <div className="flex items-center space-x-2 mt-4">
                    <Input
                      value={communityMessage}
                      onChange={(e) => setCommunityMessage(e.target.value)}
                      placeholder="Type your message to the community..."
                      onKeyPress={(e) => e.key === "Enter" && sendCommunityMessage()}
                    />
                    <Button onClick={sendCommunityMessage} disabled={!communityMessage.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}