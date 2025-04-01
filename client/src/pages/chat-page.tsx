import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useWebSocket } from "@/hooks/use-websocket";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type Chat, type Book, type CommunityChat, type Community, type User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Send, Loader2, BookOpen, Users, PlusCircle, LogOut, Globe, Lock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { queryClient, apiRequest } from "@/lib/queryClient";

type ChatRoom = {
  userId: number;
  username: string;
  lastMessage?: string;
  bookId?: number | undefined;
  bookTitle?: string;
  isSystem?: boolean; // Flag for OpenShelf system messages
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
  const [, setLocation] = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const communityScrollRef = useRef<HTMLDivElement>(null);
  const [joiningCommunityId, setJoiningCommunityId] = useState<number | null>(null);

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
  
  // Get community members to display proper user information in chats
  const { data: communityMembers } = useQuery<User[]>({
    queryKey: ["/api/communities", user?.communityId, "members"],
    enabled: !!user?.communityId,
  });

  // Get all users to display proper usernames in chats
  const { data: allUsers } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  useEffect(() => {
    if (chats && books && allUsers) {
      const rooms = new Map<number, ChatRoom>();
      
      // Special handling for OpenShelf system messages (senderId = 0)
      const systemMessages = chats.filter(chat => chat.senderId === 0);
      if (systemMessages.length > 0) {
        // Create a special room for OpenShelf system messages
        rooms.set(0, {
          userId: 0,
          username: "OpenShelf",
          lastMessage: systemMessages[systemMessages.length - 1]?.message,
          isSystem: true
        });
      }
      
      // Process regular user chats
      for (const chat of chats) {
        // Skip system messages as we've already handled them
        if (chat.senderId === 0 && chat.receiverId === user?.id) continue;
        
        const otherUserId = chat.senderId === user?.id ? chat.receiverId : chat.senderId;
        const book = chat.bookId ? books.find(b => b.id === chat.bookId) : undefined;
        const chatUser = allUsers.find(u => u.id === otherUserId);

        if (!rooms.has(otherUserId)) {
          rooms.set(otherUserId, {
            userId: otherUserId,
            username: chatUser?.username || `User #${otherUserId}`,
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
  }, [chats, books, allUsers, user?.id]);

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
                          <Avatar className="w-8 h-8">
                            {room.isSystem ? (
                              <AvatarFallback className="bg-secondary text-secondary-foreground">
                                OS
                              </AvatarFallback>
                            ) : allUsers?.find(u => u.id === room.userId)?.avatar ? (
                              <AvatarImage src={allUsers?.find(u => u.id === room.userId)?.avatar || ""} />
                            ) : (
                              <AvatarFallback className="bg-primary text-primary-foreground">
                                {room.username.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div className="font-medium">
                            {room.isSystem ? (
                              <span className="flex items-center gap-1">
                                OpenShelf <Badge variant="outline" className="text-xs">System</Badge>
                              </span>
                            ) : (
                              room.username
                            )}
                          </div>
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
                            {messages.map((msg, i) => {
                              // Special handling for OpenShelf system messages
                              const isSystemMessage = msg.senderId === 0;
                              
                              // Find the proper user information for this message
                              const messageUserId = msg.senderId === user!.id ? user!.id : msg.senderId;
                              const messageUser = isSystemMessage 
                                ? { username: "OpenShelf", avatar: null } 
                                : allUsers?.find(u => u.id === messageUserId);
                              
                              return (
                                <div
                                  key={i}
                                  className={`flex ${msg.senderId === user!.id ? "justify-end" : "justify-start"}`}
                                >
                                  {msg.senderId !== user!.id && (
                                    <Avatar className="mr-2">
                                      {isSystemMessage ? (
                                        <AvatarFallback className="bg-secondary text-secondary-foreground">
                                          OS
                                        </AvatarFallback>
                                      ) : messageUser?.avatar ? (
                                        <AvatarImage src={messageUser.avatar} />
                                      ) : (
                                        <AvatarFallback className="bg-primary text-primary-foreground">
                                          {messageUser?.username.charAt(0).toUpperCase() || "?"}
                                        </AvatarFallback>
                                      )}
                                    </Avatar>
                                  )}
                                  <div
                                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                                      msg.senderId === user!.id
                                        ? "bg-primary text-primary-foreground"
                                        : isSystemMessage
                                        ? "bg-secondary text-secondary-foreground"
                                        : "bg-muted"
                                    }`}
                                  >
                                    {msg.senderId !== user!.id && (
                                      <p className="text-xs font-medium mb-1">
                                        {isSystemMessage 
                                          ? "OpenShelf System" 
                                          : messageUser?.username || `User ${msg.senderId}`}
                                      </p>
                                    )}
                                    <p className="text-sm">{msg.message}</p>
                                    <span className="text-xs opacity-70">
                                      {new Date(msg.timestamp).toLocaleTimeString()}
                                    </span>
                                  </div>
                                  {msg.senderId === user!.id && user && (
                                    <Avatar className="ml-2">
                                      {user.avatar ? (
                                        <AvatarImage src={user.avatar} />
                                      ) : (
                                        <AvatarFallback className="bg-primary text-primary-foreground">
                                          {user.username.charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                      )}
                                    </Avatar>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 mt-4">
                          {activeChat === 0 ? (
                            <div className="w-full text-center text-sm text-muted-foreground p-2 border rounded-md">
                              This is a system notification channel. You cannot reply to these messages.
                            </div>
                          ) : (
                            <>
                              <Input
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Type your message..."
                                onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                              />
                              <Button onClick={sendMessage} disabled={!newMessage.trim()}>
                                <Send className="h-4 w-4" />
                              </Button>
                            </>
                          )}
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
                {user?.communityId ? (
                  <div className="flex flex-col h-full">
                    <div className="mb-4">
                      {communities?.find(c => c.id === user.communityId) && (
                        <div className="flex justify-between items-center bg-accent/50 p-3 rounded-lg mb-2">
                          <div>
                            <h3 className="font-medium">
                              {communities.find(c => c.id === user.communityId)?.name}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {communities.find(c => c.id === user.communityId)?.location}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                if (confirm("Are you sure you want to leave this community?")) {
                                  apiRequest("POST", `/api/communities/${user.communityId}/leave`)
                                    .then(() => {
                                      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
                                      toast({
                                        title: "Success",
                                        description: "You have left the community",
                                      });
                                    })
                                    .catch(error => {
                                      toast({
                                        title: "Error",
                                        description: error.message,
                                        variant: "destructive",
                                      });
                                    });
                                }
                              }}
                            >
                              <LogOut className="h-4 w-4 mr-1" />
                              Leave Community
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div ref={communityScrollRef} className="flex-1 overflow-y-auto pr-4">
                      <div className="space-y-4">
                        {communityChats?.map((msg, i) => {
                          // Find the proper user information for this message
                          const messageUserData = allUsers?.find(u => u.id === msg.userId);
                          const isAdmin = communities?.find(c => c.id === user.communityId)?.createdBy === msg.userId;
                          
                          const messageUser = {
                            username: messageUserData?.username || (isAdmin ? "Admin" : `User ${msg.userId}`),
                            avatar: messageUserData?.avatar || null
                          };
                            
                          return (
                            <div
                              key={i}
                              className={`flex ${msg.userId === user!.id ? "justify-end" : "justify-start"}`}
                            >
                              {msg.userId !== user!.id && (
                                <Avatar className="mr-2">
                                  {messageUser.avatar ? (
                                    <AvatarImage src={messageUser.avatar} />
                                  ) : (
                                    <AvatarFallback className="bg-primary text-primary-foreground">
                                      {messageUser.username.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                  )}
                                </Avatar>
                              )}
                              <div
                                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                                  msg.userId === user!.id
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted"
                                }`}
                              >
                                {msg.userId !== user!.id && (
                                  <p className="text-xs font-medium mb-1">{messageUser.username}</p>
                                )}
                                <p className="text-sm">{msg.message}</p>
                                <span className="text-xs opacity-70">
                                  {new Date(msg.timestamp).toLocaleTimeString()}
                                </span>
                              </div>
                              {msg.userId === user?.id && user && (
                                <Avatar className="ml-2">
                                  {user.avatar ? (
                                    <AvatarImage src={user.avatar} />
                                  ) : (
                                    <AvatarFallback className="bg-primary text-primary-foreground">
                                      {user.username.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                  )}
                                </Avatar>
                              )}
                            </div>
                          );
                        })}
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
                ) : (
                  <div className="p-4">
                    <Card className="mb-6">
                      <CardHeader>
                        <CardTitle>Join a Community</CardTitle>
                        <CardDescription>
                          Join a community to chat with other members and share books.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Button onClick={() => setLocation("/select-community")}>
                            <Users className="mr-2 h-4 w-4" />
                            Browse Communities
                          </Button>
                          <Button variant="outline" onClick={() => setLocation("/select-community?create=true")}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Create Community
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                    
                    {communities && communities.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Featured Communities</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {communities.slice(0, 4).map(community => (
                            <Card key={community.id} className="overflow-hidden">
                              <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                  <CardTitle className="text-base">{community.name}</CardTitle>
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
                                <CardDescription className="text-xs">{community.location}</CardDescription>
                              </CardHeader>
                              <CardContent className="pt-0">
                                <p className="text-sm mb-3 line-clamp-2">{community.description}</p>
                                <Button 
                                  size="sm" 
                                  className="w-full"
                                  disabled={joiningCommunityId === community.id}
                                  onClick={() => {
                                    // Set joining state
                                    setJoiningCommunityId(community.id);
                                    
                                    apiRequest("POST", `/api/communities/${community.id}/join`)
                                      .then(res => res.json())
                                      .then(data => {
                                        queryClient.invalidateQueries({ queryKey: ["/api/user"] });
                                        
                                        if (data.pendingApproval) {
                                          toast({
                                            title: "Request Submitted",
                                            description: "Your request to join the community has been sent to the admin",
                                          });
                                        } else {
                                          toast({
                                            title: "Success",
                                            description: "Joined community successfully",
                                          });
                                        }
                                        
                                        // Reset joining state
                                        setJoiningCommunityId(null);
                                      })
                                      .catch(error => {
                                        toast({
                                          title: "Error joining community",
                                          description: error.message,
                                          variant: "destructive",
                                        });
                                        
                                        // Reset joining state
                                        setJoiningCommunityId(null);
                                      });
                                  }}
                                >
                                  <Users className="mr-2 h-3 w-3" />
                                  {joiningCommunityId === community.id ? "Joining..." : "Join"}
                                </Button>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}