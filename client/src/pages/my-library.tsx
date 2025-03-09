import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertBookSchema, type InsertBook, type Book, bookGenres } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Plus, BookOpen, Clock, Loader2, Library, Upload } from "lucide-react";
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
      condition: "good",
      genre: "Fiction",
      ownerId: user?.id
    },
  });

  const { data: myBooks, isLoading: loadingBooks } = useQuery<Book[]>({
    queryKey: ["/api/books"],
    select: (books) => books.filter(b => b.ownerId === user?.id),
  });

  const { data: borrowedBooks, isLoading: loadingBorrowed } = useQuery<Book[]>({
    queryKey: ["/api/books"],
    select: (books) => books.filter(b => b.borrowerId === user?.id),
  });

  const addBookMutation = useMutation({
    mutationFn: async (bookData: InsertBook) => {
      const res = await apiRequest("POST", "/api/books", bookData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      toast({
        title: "Success!",
        description: "Book added successfully! You earned 0.5 credits.",
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

  if (loadingBooks || loadingBorrowed) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <section className="bg-primary text-primary-foreground py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Library className="h-8 w-8" />
              <h1 className="text-3xl font-bold">My Library</h1>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Book
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
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
                          <FormMessage />
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
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="genre"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Genre</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a genre" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {bookGenres.map((genre) => (
                                <SelectItem key={genre} value={genre}>
                                  {genre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
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
                          <FormMessage />
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
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="imageUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Book Image URL</FormLabel>
                          <FormControl>
                            <Input {...field} type="url" placeholder="https://example.com/book-image.jpg" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full" disabled={addBookMutation.isPending}>
                      {addBookMutation.isPending ? "Adding Book..." : "Add Book"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="listed" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2 bg-primary/5">
            <TabsTrigger value="listed" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Listed Books
            </TabsTrigger>
            <TabsTrigger value="borrowed" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Borrowed Books
            </TabsTrigger>
          </TabsList>

          <TabsContent value="listed">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myBooks?.map(book => (
                <Card key={book.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  {book.imageUrl && (
                    <img src={book.imageUrl} alt={book.title} className="w-full h-48 object-cover" />
                  )}
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <BookOpen className="h-5 w-5 text-primary" />
                      <span>{book.title}</span>
                    </CardTitle>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{book.author}</p>
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                        {book.genre}
                      </span>
                    </div>
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
          </TabsContent>

          <TabsContent value="borrowed">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {borrowedBooks?.map(book => (
                <Card key={book.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  {book.imageUrl && (
                    <img src={book.imageUrl} alt={book.title} className="w-full h-48 object-cover" />
                  )}
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <BookOpen className="h-5 w-5 text-primary" />
                      <span>{book.title}</span>
                    </CardTitle>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{book.author}</p>
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                        {book.genre}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{book.description}</p>
                    <div className="mt-2 flex items-center text-sm text-muted-foreground">
                      <Clock className="mr-1 h-4 w-4" />
                      <span>Due {new Date(book.borrowDeadline!).toLocaleDateString()}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}