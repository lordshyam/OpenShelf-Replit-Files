import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Chat, type Book } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Send, Loader2 } from "lucide-react";

type Message = {
  id: number;
  senderId: number;
  receiverId: number;
  message: string;
  timestamp: string;
  bookId?: number;
};

export default function ChatPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const { data: books, isLoading: loadingBooks } = useQuery<Book[]>({
    queryKey: ["/api/books"],
    select: (books) => books.filter(b => 
      b.borrowed && (b.ownerId === user?.id || b.borrowerId === user?.id)
    ),
  });

  const { data: chats, isLoading: loadingChats } = useQuery<Chat[]>({
    queryKey: ["/api/chats", user?.id],
  });

  useEffect(() => {
    if (chats) {
      setMessages(chats);
    }
  }, [chats]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      setMessages(prev => [...prev, message]);
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
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = () => {
    if (!newMessage.trim() || !wsRef.current) return;

    const message = {
      senderId: user!.id,
      receiverId: books![0].ownerId === user!.id ? books![0].borrowerId! : books![0].ownerId,
      message: newMessage,
      bookId: books![0].id,
    };

    wsRef.current.send(JSON.stringify(message));
    setNewMessage("");
  };

  if (loadingBooks || loadingChats) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!books?.length) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              No active book borrowings. Borrow or lend a book to start chatting!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="h-[calc(100vh-8rem)]">
        <CardHeader>
          <CardTitle>Chat</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col h-full">
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
        </CardContent>
      </Card>
    </div>
  );
}
