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
import { insertBookSchema, type InsertBook, type Book, type BorrowRequest, bookGenres } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Plus, BookOpen, Clock, Loader2, Library, Upload, Camera, Check, X, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { BookImage } from "@/components/book-image";

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
      ownerId: user?.id || 0
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

  const { data: borrowRequests, isLoading: loadingRequests } = useQuery<BorrowRequest[]>({
    queryKey: ["/api/borrow-requests", user?.id],
    enabled: !!user?.id,
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
        ownerId: user.id
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

  const acceptRequestMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const res = await apiRequest("POST", `/api/borrow-requests/${requestId}/accept`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to accept request");
      }
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/borrow-requests", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      toast({
        title: "Request Accepted",
        description: "The book borrowing request has been accepted and a chat was created.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error accepting request",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const declineRequestMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const res = await apiRequest("POST", `/api/borrow-requests/${requestId}/decline`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to decline request");
      }
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/borrow-requests", user?.id] });
      toast({
        title: "Request Declined",
        description: "The book borrowing request has been declined.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error declining request",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (loadingBooks || loadingBorrowed || loadingRequests) {
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
                        <div className="relative w-full rounded-lg overflow-hidden">
                          <div className="relative h-48">
                            <img src={imagePreview} alt="Preview" className="w-full h-full object-contain" />
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
          <TabsList className="grid w-full max-w-md grid-cols-3 bg-primary/5">
            <TabsTrigger value="listed" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Listed Books
            </TabsTrigger>
            <TabsTrigger value="borrowed" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Borrowed Books
            </TabsTrigger>
            <TabsTrigger value="requests" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Borrow Requests
            </TabsTrigger>
          </TabsList>

          <TabsContent value="listed">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myBooks?.map(book => (
                <Card key={book.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <BookImage 
                    imageUrl={book.imageUrl} 
                    title={book.title} 
                    height="h-48"
                  />
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
                  <BookImage 
                    imageUrl={book.imageUrl} 
                    title={book.title} 
                    height="h-48"
                  />
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

          <TabsContent value="requests">
            <div className="space-y-4">
              {borrowRequests?.length === 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>No requests</AlertTitle>
                  <AlertDescription>
                    You don't have any active borrow requests to review.
                  </AlertDescription>
                </Alert>
              )}
              
              {borrowRequests?.filter(req => req.status === "pending").map(request => {
                const book = myBooks?.find(b => b.id === request.bookId);
                if (!book) return null;
                
                return (
                  <Card key={request.id} className="overflow-hidden">
                    <div className="flex flex-col md:flex-row">
                      <div className="w-full md:w-1/4">
                        <BookImage 
                          imageUrl={book.imageUrl} 
                          title={book.title} 
                          height="h-48 md:h-full"
                        />
                      </div>
                      <div className="flex-1 p-4">
                        <h3 className="text-lg font-bold flex items-center">
                          <BookOpen className="h-5 w-5 text-primary mr-2" />
                          {book.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-2">{book.author}</p>
                        <div className="text-sm mb-4">
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                            {book.genre}
                          </span>
                        </div>
                        <Alert className="mb-4">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Borrow Request</AlertTitle>
                          <AlertDescription>
                            User #{request.requesterId} would like to borrow this book. 
                            If approved, they will be able to borrow it for 14 days.
                          </AlertDescription>
                        </Alert>
                        <div className="flex space-x-4">
                          <Button 
                            className="flex-1" 
                            variant="default"
                            onClick={() => acceptRequestMutation.mutate(request.id)}
                            disabled={acceptRequestMutation.isPending || declineRequestMutation.isPending}
                          >
                            {acceptRequestMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Check className="h-4 w-4 mr-2" />
                            )}
                            Accept
                          </Button>
                          <Button 
                            className="flex-1" 
                            variant="outline"
                            onClick={() => declineRequestMutation.mutate(request.id)}
                            disabled={acceptRequestMutation.isPending || declineRequestMutation.isPending}
                          >
                            {declineRequestMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <X className="h-4 w-4 mr-2" />
                            )}
                            Decline
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}

              {borrowRequests && borrowRequests.filter(req => req.status !== "pending").length > 0 && (
                <div className="mt-8">
                  <h3 className="text-lg font-semibold mb-4">Past Request History</h3>
                  <div className="space-y-4">
                    {borrowRequests.filter(req => req.status !== "pending").map(request => {
                      const book = myBooks?.find(b => b.id === request.bookId);
                      if (!book) return null;
                      
                      return (
                        <Card key={request.id} className="overflow-hidden">
                          <div className="p-4">
                            <div className="flex items-center justify-between">
                              <h3 className="text-lg font-medium flex items-center">
                                <BookOpen className="h-5 w-5 text-primary mr-2" />
                                {book.title}
                              </h3>
                              <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                request.status === 'accepted' 
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              User #{request.requesterId} - Request date: {new Date(request.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}