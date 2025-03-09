import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Book as BookIcon, MapPin, UserCheck } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Book } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

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
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col space-y-8">
        <div className="flex items-center space-x-4">
          <Input 
            placeholder="Search books by title or author..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-xl"
          />
        </div>

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
          ) : filteredBooks?.map(book => (
            <Card key={book.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BookIcon className="h-5 w-5 text-primary" />
                  <span>{book.title}</span>
                </CardTitle>
                <p className="text-sm text-muted-foreground">{book.author}</p>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-24">
                  <p className="text-sm">{book.description}</p>
                </ScrollArea>
                <div className="flex items-center mt-4 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 mr-1" />
                  <span>{book.location}</span>
                </div>
              </CardContent>
              <CardFooter className="mt-auto">
                <Button 
                  className="w-full"
                  disabled={book.borrowed || book.donated}
                  onClick={() => {
                    fetch(`/api/books/${book.id}/borrow`, { method: 'POST' })
                      .then(res => {
                        if (!res.ok) throw new Error("Failed to borrow book");
                        toast({
                          title: "Success",
                          description: "Book borrowed successfully",
                        });
                      })
                      .catch(err => {
                        toast({
                          title: "Error borrowing book",
                          description: err.message,
                          variant: "destructive",
                        });
                      });
                  }}
                >
                  {book.borrowed ? (
                    <div className="flex items-center">
                      <UserCheck className="mr-2 h-4 w-4" />
                      Currently Borrowed
                    </div>
                  ) : book.donated ? (
                    "Donated"
                  ) : (
                    "Borrow Book"
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
