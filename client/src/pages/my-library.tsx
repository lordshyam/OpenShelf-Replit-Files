import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { CalendarIcon, Plus, BookOpen, Clock, Loader2, Library, Upload, Camera, Check, X, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { BookImage } from "@/components/book-image";
import { CameraCapture } from "@/components/camera-capture";

export default function MyLibrary() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  // Set the default tab based on sessionStorage (for requests coming from notifications)
  const [activeTab, setActiveTab] = useState<string>(() => {
    const savedTab = typeof window !== 'undefined' 
      ? sessionStorage.getItem('openMyLibraryTab') 
      : null;
    
    // Remove the item from sessionStorage after reading it
    if (savedTab) {
      sessionStorage.removeItem('openMyLibraryTab');
    }
    
    return savedTab || 'listed';
  });

  // State for book search results
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedBook, setSelectedBook] = useState<any | null>(null);
  
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
  
  // Function to search books from Google Books API
  const searchBooks = async (query: string) => {
    if (!query || query.length < 3) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const response = await fetch(`/api/books/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) {
        throw new Error("Failed to search books");
      }
      
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error("Error searching books:", error);
      toast({
        title: "Error",
        description: "Failed to search for books. Please try again.",
        variant: "destructive",
      });
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };
  
  // Debounce the search to avoid too many requests
  const debouncedSearch = (query: string) => {
    setSearchQuery(query);
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }
    
    // Clear any pending timeouts
    if (window.searchTimeout) {
      clearTimeout(window.searchTimeout);
    }
    
    // Set a new timeout
    window.searchTimeout = setTimeout(() => {
      searchBooks(query);
    }, 300); // 300ms delay
  };
  
  // Function to handle selection of a book from search results
  const handleBookSelect = (book: any) => {
    setSelectedBook(book);
    setSearchResults([]);
    setSearchQuery("");
    
    // Populate form fields with the selected book data
    form.setValue("title", book.title);
    form.setValue("author", book.author);
    form.setValue("description", book.description || "");
    form.setValue("genre", book.genre || "Fiction");
    
    // If the book has an image, set it
    if (book.imageUrl) {
      setImagePreview(book.imageUrl);
      form.setValue("imageUrl", book.imageUrl);
    }
  };

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
      // Invalidate both books and user queries to refresh credits display
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      
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
  
  const handleCameraCapture = (imageSrc: string) => {
    setImagePreview(imageSrc);
    form.setValue("imageUrl", imageSrc);
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
    
    // Additional validation to ensure required fields are provided
    if (!data.title || data.title.trim() === "") {
      toast({
        title: "Missing Information",
        description: "Please provide a book title",
        variant: "destructive",
      });
      return;
    }
    
    if (!data.author || data.author.trim() === "") {
      toast({
        title: "Missing Information",
        description: "Please provide the author's name",
        variant: "destructive",
      });
      return;
    }
    
    if (!data.description || data.description.trim() === "") {
      toast({
        title: "Missing Information",
        description: "Please provide a book description",
        variant: "destructive",
      });
      return;
    }
    
    if (!data.imageUrl || data.imageUrl.trim() === "") {
      toast({
        title: "Missing Information",
        description: "Please upload a book image",
        variant: "destructive",
      });
      return;
    }
    
    addBookMutation.mutate(data);
  };

  // State for managing return date selection dialog
  const [returnDateDialogOpen, setReturnDateDialogOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [selectedReturnDate, setSelectedReturnDate] = useState<Date | undefined>(
    // Default to two weeks from now
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  );

  // Function to handle the accept button click
  const handleAcceptRequest = (requestId: number) => {
    setSelectedRequestId(requestId);
    setReturnDateDialogOpen(true);
  };

  // Function to confirm the request acceptance with the selected return date
  const confirmAcceptRequest = () => {
    if (selectedRequestId && selectedReturnDate) {
      acceptRequestMutation.mutate({
        requestId: selectedRequestId,
        returnDate: selectedReturnDate
      });
      setReturnDateDialogOpen(false);
    }
  };

  const acceptRequestMutation = useMutation({
    mutationFn: async ({ requestId, returnDate }: { requestId: number, returnDate: Date }) => {
      const res = await apiRequest("POST", `/api/borrow-requests/${requestId}/accept`, { returnDate });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to accept request");
      }
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/borrow-requests", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] }); // Refresh user credits
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
  
  const markBookReturnedMutation = useMutation({
    mutationFn: async ({ bookId, returned }: { bookId: number, returned: boolean}) => {
      const res = await apiRequest("POST", `/api/books/${bookId}/return`, { returned });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || `Failed to mark book as ${returned ? 'returned' : 'not returned'}`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      toast({
        title: "Success!",
        description: "Book return status updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating book return status",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const returnBookEarlyMutation = useMutation({
    mutationFn: async (bookId: number) => {
      const res = await apiRequest("POST", `/api/books/${bookId}/return-early`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to return book early");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      toast({
        title: "Success!",
        description: "Book marked for early return. Please return the physical book to the owner.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error returning book early",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const confirmBookReturnMutation = useMutation({
    mutationFn: async (bookId: number) => {
      const res = await apiRequest("POST", `/api/books/${bookId}/confirm-return`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to confirm book return");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] }); // Refresh user credits
      toast({
        title: "Return Confirmed!",
        description: "Book has been returned to your collection and is now available for lending again.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error confirming book return",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Define mutation for toggling book visibility (listed/unlisted)
  const toggleBookVisibilityMutation = useMutation({
    mutationFn: async (bookId: number) => {
      const res = await apiRequest("POST", `/api/books/${bookId}/toggle-visibility`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to toggle book visibility");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      toast({
        title: data.unlisted ? "Book Unlisted" : "Book Listed",
        description: data.unlisted 
          ? "The book is now hidden from other users." 
          : "The book is now visible to other users.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error toggling visibility",
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
    <>
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
                      {/* Book search component */}
                      <div className="space-y-2">
                        <Label htmlFor="book-search">Type to search for a book</Label>
                        <div className="relative">
                          <Input
                            id="book-search"
                            placeholder="Enter title, author, or ISBN..."
                            value={searchQuery}
                            onChange={(e) => debouncedSearch(e.target.value)}
                            className="w-full pr-10"
                          />
                          {isSearching && (
                            <div className="absolute right-3 top-2.5">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        {searchResults.length > 0 && (
                          <div className="rounded-md border bg-background shadow-sm mt-2">
                            <ul className="divide-y max-h-64 overflow-y-auto">
                              {searchResults.map((book) => (
                                <li
                                  key={book.id}
                                  className="flex items-start p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                                  onClick={() => handleBookSelect(book)}
                                >
                                  <div className="h-16 w-12 flex-shrink-0 mr-3">
                                    {book.imageUrl ? (
                                      <img src={book.imageUrl} alt={book.title} className="h-full w-full object-cover rounded" />
                                    ) : (
                                      <div className="h-full w-full bg-muted flex items-center justify-center rounded">
                                        <BookOpen className="h-6 w-6 text-muted-foreground" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{book.title}</p>
                                    <p className="text-xs text-muted-foreground truncate">{book.author}</p>
                                    {book.genre && (
                                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary mt-1">
                                        {book.genre}
                                      </span>
                                    )}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Show selected book info if any */}
                        {selectedBook && (
                          <div className="rounded-md border bg-background p-3 shadow-sm mt-2">
                            <div className="flex items-center space-x-3">
                              {selectedBook.imageUrl && (
                                <img src={selectedBook.imageUrl} alt={selectedBook.title} className="h-12 w-10 object-cover rounded" />
                              )}
                              <div>
                                <p className="font-medium text-sm">{selectedBook.title}</p>
                                <p className="text-xs text-muted-foreground">{selectedBook.author}</p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedBook(null)}
                                className="ml-auto"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>

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
                      <FormField
                        control={form.control}
                        name="imageUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Book Image</FormLabel>
                            <div className="space-y-4">
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
                                <div>
                                  <Button 
                                    type="button" 
                                    variant="outline" 
                                    className="w-full"
                                    onClick={() => setCameraOpen(true)}
                                  >
                                    <Camera className="mr-2 h-4 w-4" />
                                    Use Camera
                                  </Button>
                                </div>
                              </div>
                              {!imagePreview && (
                                <p className="text-sm text-muted-foreground">
                                  Please upload or capture an image of the book cover
                                </p>
                              )}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
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
          <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab} className="space-y-6">
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
                        <>
                          <div className="mt-2 flex items-center text-sm text-muted-foreground">
                            <Clock className="mr-1 h-4 w-4" />
                            <span>Borrowed until {new Date(book.borrowDeadline!).toLocaleDateString()}</span>
                          </div>
                          
                          {/* Return status badge */}
                          <div className="mt-2">
                            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                              book.returned 
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" 
                                : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100"
                            }`}>
                              {book.returned ? "Returned" : "Not Returned"}
                            </span>
                          </div>
                        </>
                      )}
                    </CardContent>
                    <CardFooter className="pt-0">
                      {book.borrowed ? (
                        <>
                          {book.returned ? (
                            <div className="w-full grid grid-cols-2 gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => confirmBookReturnMutation.mutate(book.id)}
                                disabled={confirmBookReturnMutation.isPending}
                                className="flex-1"
                              >
                                <Check className="mr-1 h-4 w-4" />
                                Confirm Return
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => markBookReturnedMutation.mutate({ bookId: book.id, returned: false })}
                                disabled={markBookReturnedMutation.isPending}
                                className="flex-1"
                              >
                                <X className="mr-1 h-4 w-4" />
                                Not Returned
                              </Button>
                            </div>
                          ) : (
                            <Alert className="bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800">
                              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                              <AlertTitle className="text-amber-800 dark:text-amber-400">Currently Borrowed</AlertTitle>
                              <AlertDescription className="text-amber-700 dark:text-amber-500 text-xs">
                                This book is currently borrowed and will be available once returned.
                              </AlertDescription>
                            </Alert>
                          )}
                        </>
                      ) : (
                        <div className="w-full">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleBookVisibilityMutation.mutate(book.id)}
                            disabled={toggleBookVisibilityMutation.isPending}
                            className="w-full"
                          >
                            {book.unlisted ? (
                              <>
                                <Eye className="mr-1 h-4 w-4" />
                                List Book
                              </>
                            ) : (
                              <>
                                <EyeOff className="mr-1 h-4 w-4" />
                                Unlist Book
                              </>
                            )}
                          </Button>
                          {book.unlisted && (
                            <p className="text-xs text-muted-foreground mt-2 text-center">
                              This book is not visible to other users
                            </p>
                          )}
                        </div>
                      )}
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="borrowed">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {borrowedBooks?.length === 0 && (
                  <Alert className="col-span-full">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No borrowed books</AlertTitle>
                    <AlertDescription>
                      You haven't borrowed any books yet.
                    </AlertDescription>
                  </Alert>
                )}
                
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
                      
                      {/* Return status badge */}
                      <div className="mt-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          book.returned 
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" 
                            : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100"
                        }`}>
                          {book.returned ? "Returned" : "Not Returned"}
                        </span>
                      </div>
                    </CardContent>
                    <CardFooter className="pt-0">
                      {!book.returned && (
                        <div className="w-full grid grid-cols-2 gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => markBookReturnedMutation.mutate({ bookId: book.id, returned: true })}
                            disabled={markBookReturnedMutation.isPending}
                            className="w-full"
                          >
                            <Check className="mr-1 h-4 w-4" />
                            Mark as Returned
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => returnBookEarlyMutation.mutate(book.id)}
                            disabled={returnBookEarlyMutation.isPending}
                            className="w-full"
                          >
                            <Clock className="mr-1 h-4 w-4" />
                            Return Early
                          </Button>
                        </div>
                      )}
                      {book.returned && (
                        <Alert className="bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800">
                          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <AlertTitle className="text-green-800 dark:text-green-400">Marked as returned</AlertTitle>
                          <AlertDescription className="text-green-700 dark:text-green-500 text-xs">
                            Please ensure you return the physical book to the owner.
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardFooter>
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
                              onClick={() => handleAcceptRequest(request.id)}
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
      
      {/* Camera component */}
      <CameraCapture 
        open={cameraOpen} 
        onClose={() => setCameraOpen(false)} 
        onCapture={handleCameraCapture} 
      />

      {/* Return Date Dialog */}
      <Dialog open={returnDateDialogOpen} onOpenChange={setReturnDateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Set Return Date</DialogTitle>
            <DialogDescription>
              Select when the book should be returned. The borrower will be notified of this date.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="return-date">Return Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="return-date"
                    variant="outline"
                    className="justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedReturnDate ? (
                      format(selectedReturnDate, "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedReturnDate}
                    onSelect={(date) => date && setSelectedReturnDate(date)}
                    disabled={(date) => date < new Date() || date < new Date(Date.now() + 24 * 60 * 60 * 1000)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <p className="text-sm text-muted-foreground">
                Return date must be at least 1 day from now. Default is two weeks.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnDateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmAcceptRequest} disabled={!selectedReturnDate}>
              Confirm & Accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}