import { useState } from "react";
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
import { Plus, BookOpen, Clock, Loader2, Library, Upload, Camera } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";

export default function MyLibrary() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm<InsertBook>({
    resolver: zodResolver(insertBookSchema),
    defaultValues: {
      title: "",
      author: "",
      description: "",
      condition: "good",
      genre: "Fiction",
      imageUrl: "",
      ownerId: user?.id || 0,
      communityId: user?.communityId || 0
    },
    mode: "onChange"
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
      if (!user?.id) {
        throw new Error("Please login to add books");
      }
      
      if (!user?.communityId) {
        throw new Error("Please join a community before adding books");
      }

      const res = await apiRequest("POST", "/api/books", {
        ...bookData,
        ownerId: user.id,
        communityId: user.communityId
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to add book");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      toast({
        title: "Success!",
        description: "Book added successfully! You earned 0.5 credits.",
      });
      form.reset();
      setImagePreview(null);
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error adding book",
        description: error.message || "Failed to add book. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Image too large",
        description: "Please choose an image under 5MB",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    form.setValue("imageUrl", await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    }));
  };

  const onSubmit = (data: InsertBook) => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "Please login to add books",
        variant: "destructive",
      });
      return;
    }
    if (!user?.communityId) {
      toast({
        title: "Error",
        description: "Please join a community before adding books",
        variant: "destructive",
      });
      return;
    }
    addBookMutation.mutate(data);
  };

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
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Book
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add a New Book</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                            <Textarea {...field} value={field.value || ''} />
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
                            <Input {...field} value={field.value || ''} placeholder="e.g. like new, good, fair" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="space-y-4">
                      <label className="block text-sm font-medium">Book Image</label>
                      {imagePreview && (
                        <div className="relative w-full h-48 rounded-lg overflow-hidden">
                          <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={() => {
                              setImagePreview(null);
                              form.setValue("imageUrl", "");
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageCapture}
                            className="hidden"
                            id="image-upload"
                          />
                          <label htmlFor="image-upload">
                            <Button type="button" variant="outline" className="w-full" asChild>
                              <span>
                                <Upload className="mr-2 h-4 w-4" />
                                Upload Image
                              </span>
                            </Button>
                          </label>
                        </div>
                        {/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && (
                          <div>
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={handleImageCapture}
                              className="hidden"
                              id="camera-capture"
                            />
                            <label htmlFor="camera-capture">
                              <Button type="button" variant="outline" className="w-full" asChild>
                                <span>
                                  <Camera className="mr-2 h-4 w-4" />
                                  Take Photo
                                </span>
                              </Button>
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={addBookMutation.isPending}
                    >
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