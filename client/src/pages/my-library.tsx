import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertBookSchema, type InsertBook, type Book } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Plus, BookOpen, Clock, Loader2 } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";

export default function MyLibrary() {
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm<InsertBook>({
    resolver: zodResolver(insertBookSchema),
    defaultValues: {
      title: "",
      author: "",
      description: "",
      location: "",
      condition: "good",
    },
  });

  const { data: myBooks, isLoading } = useQuery<Book[]>({
    queryKey: ["/api/books"],
    select: (books) => books.filter(b => b.ownerId === user?.id),
  });

  const { data: borrowedBooks } = useQuery<Book[]>({
    queryKey: ["/api/books"],
    select: (books) => books.filter(b => b.borrowerId === user?.id),
  });

  const addBookMutation = useMutation({
    mutationFn: async (book: InsertBook) => {
      const res = await apiRequest("POST", "/api/books", book);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      toast({
        title: "Success",
        description: "Book added successfully",
      });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error adding book",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const returnBookMutation = useMutation({
    mutationFn: async (bookId: number) => {
      await apiRequest("POST", `/api/books/${bookId}/return`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      toast({
        title: "Success",
        description: "Book returned successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error returning book",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid gap-8">
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">My Listed Books</h2>
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Book
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add a New Book</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit((data) => addBookMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="author"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Author</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g. 2km from city center" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="condition"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Condition</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g. like new, good, fair" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full" loading={addBookMutation.isPending}>
                      Add Book
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myBooks?.map(book => (
              <Card key={book.id}>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    <span>{book.title}</span>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{book.author}</p>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{book.description}</p>
                  {book.borrowed && (
                    <div className="mt-2 flex items-center text-sm text-muted-foreground">
                      <Clock className="mr-1 h-4 w-4" />
                      <span>Borrowed until {new Date(book.borrowDeadline!).toLocaleDateString()}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4">Borrowed Books</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {borrowedBooks?.map(book => (
              <Card key={book.id}>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    <span>{book.title}</span>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{book.author}</p>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{book.description}</p>
                  <div className="mt-2 flex items-center text-sm text-muted-foreground">
                    <Clock className="mr-1 h-4 w-4" />
                    <span>Due {new Date(book.borrowDeadline!).toLocaleDateString()}</span>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => returnBookMutation.mutate(book.id)}
                    loading={returnBookMutation.isPending}
                  >
                    Return Book
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
