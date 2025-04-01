import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Book as BookIcon, MapPin, UserCheck, Search, BookOpen, Library } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Book, InsertBook } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { BookImage } from "@/components/book-image";

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: books, isLoading, error } = useQuery<Book[]>({
    queryKey: ["/api/books", user?.communityId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/books?communityId=${user?.communityId}`);
      return res.json();
    },
    enabled: !!user?.communityId,
    select: (books) => books.filter(book =>
      !book.borrowed && !book.donated && (
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book.author.toLowerCase().includes(searchQuery.toLowerCase())
      )
    ),
  });

  const createBookMutation = useMutation({
    mutationFn: async (bookData: InsertBook) => {
      const res = await apiRequest("POST", "/api/books", bookData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/books", user?.communityId] });
      toast({
        title: "Success",
        description: "Book added successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error adding book",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const borrowBookMutation = useMutation({
    mutationFn: async (bookId: string | number) => {
      const res = await apiRequest("POST", `/api/books/${bookId}/borrow`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Borrow request sent to the owner",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating borrow request",
        description: error.message,
        variant: "destructive",
      });
    },
  });


  if (error) {
    toast({
      title: "Error loading books",
      description: error.message,
      variant: "destructive",
    });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="bg-primary text-primary-foreground py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <BookOpen className="h-16 w-16 mx-auto mb-6" />
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Welcome to OpenShelf</h1>
            <p className="text-xl mb-8">Discover, share, and connect through books in your community</p>

            <div className="relative max-w-xl mx-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted" />
              <Input
                placeholder="Search books by title or author..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-background/10 border-primary-foreground/20"
              />
            </div>

            <div className="flex justify-center gap-8 mt-8">
              <div className="text-center">
                <Library className="h-8 w-8 mx-auto mb-2" />
                <h3 className="font-semibold">Share Books</h3>
                <p className="text-sm">Earn 0.5 credits</p>
              </div>
              <div className="text-center">
                <BookOpen className="h-8 w-8 mx-auto mb-2" />
                <h3 className="font-semibold">Borrow Books</h3>
                <p className="text-sm">Use 1 credit</p>
              </div>
              <div className="text-center">
                <UserCheck className="h-8 w-8 mx-auto mb-2" />
                <h3 className="font-semibold">Build Community</h3>
                <p className="text-sm">Connect with readers</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Available Books Section */}
      <section className="container mx-auto px-4 py-12">
        <h2 className="text-3xl font-bold mb-8">Available Books</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            Array(6).fill(0).map((_, i) => (
              <Card key={i} className="flex flex-col overflow-hidden">
                <Skeleton className="h-48 w-full" />
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-1/4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-24 w-full" />
                </CardContent>
                <CardFooter>
                  <Skeleton className="h-10 w-full" />
                </CardFooter>
              </Card>
            ))
          ) : books?.map(book => (
            <Card key={book.id} className="flex flex-col overflow-hidden hover:shadow-lg transition-shadow">
              <BookImage 
                imageUrl={book.imageUrl} 
                title={book.title} 
              />
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BookIcon className="h-5 w-5 text-primary" />
                  <span>{book.title}</span>
                </CardTitle>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{book.author}</p>
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                    {book.genre}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex-grow">
                <ScrollArea className="h-24">
                  <p className="text-sm">{book.description}</p>
                </ScrollArea>
                <div className="flex items-center mt-4 text-sm text-muted-foreground">
                  <div className="flex items-center">
                    <UserCheck className="h-4 w-4 mr-1" />
                    <span>Available for borrowing</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  disabled={(user?.credits ?? 0) < 1 || book.ownerId === user?.id || borrowBookMutation.isPending}
                  onClick={() => {
                    const userCredits = user?.credits ?? 0;
                    if (userCredits < 1) {
                      toast({
                        title: "Insufficient credits",
                        description: "You need 1 credit to borrow a book. List your books to earn credits!",
                        variant: "destructive",
                      });
                      return;
                    }

                    if (book.ownerId === user?.id) {
                      toast({
                        title: "Cannot borrow own book",
                        description: "You cannot borrow books that you have listed.",
                        variant: "destructive",
                      });
                      return;
                    }

                    borrowBookMutation.mutate(book.id.toString());
                  }}
                >
                  {book.ownerId === user?.id ? "Your Book" : 
                   borrowBookMutation.isPending ? "Sending Request..." : "Borrow Book"}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}