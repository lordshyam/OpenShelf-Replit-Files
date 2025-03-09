import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Book as BookIcon, MapPin, UserCheck, Search, BookOpen, Library } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Book } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: books, isLoading, error } = useQuery<Book[]>({
    queryKey: ["/api/books"],
  });

  if (error) {
    toast({
      title: "Error loading books",
      description: error.message,
      variant: "destructive",
    });
  }

  const filteredBooks = books?.filter(book => 
    book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    book.author.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              <Card key={i} className="flex flex-col">
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-24 w-full" />
                </CardContent>
                <CardFooter>
                  <Skeleton className="h-10 w-full" />
                </CardFooter>
              </Card>
            ))
          ) : filteredBooks?.filter(book => !book.borrowed && !book.donated).map(book => (
            <Card key={book.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BookIcon className="h-5 w-5 text-primary" />
                  <span>{book.title}</span>
                </CardTitle>
                <p className="text-sm text-muted-foreground">{book.author}</p>
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
                  disabled={user?.credits < 1 || book.ownerId === user?.id}
                  onClick={() => {
                    if (user?.credits < 1) {
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

                    // Create a borrow request
                    fetch(`/api/books/${book.id}/borrow`, { 
                      method: 'POST',
                      credentials: 'include',
                    })
                      .then(res => {
                        if (!res.ok) throw new Error("Failed to create borrow request");
                        toast({
                          title: "Success",
                          description: "Borrow request sent to the owner",
                        });
                      })
                      .catch(err => {
                        toast({
                          title: "Error creating borrow request",
                          description: err.message,
                          variant: "destructive",
                        });
                      });
                  }}
                >
                  {book.ownerId === user?.id ? "Your Book" : "Borrow Book"}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}