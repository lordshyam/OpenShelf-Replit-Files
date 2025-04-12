import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  AlertCircle, Trash2, RefreshCw, Users, BookOpen, Home, Ban, FileText, 
  ChevronDown, Check, X, Eye, EyeOff, Shield, UserX, User, BarChart 
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Tabs, TabsContent, TabsList, TabsTrigger 
} from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCredits } from '@/lib/format-credits';

// Define interfaces for data types
interface AdminStats {
  users: {
    total: number;
    active: number;
    suspended: number;
    banned: number;
  };
  books: {
    total: number;
    available: number;
    borrowed: number;
    unlisted: number;
  };
  communities: {
    total: number;
  };
  requests: {
    pendingBorrows: number;
    pendingReports: number;
  };
}

interface User {
  id: number;
  username: string;
  email: string;
  credits: number;
  avatar?: string;
  status?: string;
  role?: string;
  communityId?: number;
  state?: string;
  city?: string;
}

interface Book {
  id: number;
  title: string;
  author: string;
  ownerId: number;
  ownerUsername?: string;
  borrowed: boolean;
  borrowerId?: number;
  borrowerUsername?: string;
  imageUrl?: string;
  genre: string;
  unlisted?: boolean;
}

interface Community {
  id: number;
  name: string;
  description?: string;
  location: string;
  createdBy: number;
  creatorUsername?: string;
  memberCount?: number;
  isPublic: boolean;
}

interface UserReport {
  id: number;
  reporterId: number;
  reporterUsername?: string;
  reportedUserId: number;
  reportedUsername?: string;
  reportType: string;
  description: string;
  bookId?: number;
  bookTitle?: string;
  status: string;
  createdAt: string;
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isResetting, setIsResetting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [selectedCommunityId, setSelectedCommunityId] = useState<number | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [userActionDialogOpen, setUserActionDialogOpen] = useState(false);
  const [bookActionDialogOpen, setBookActionDialogOpen] = useState(false);
  const [communityActionDialogOpen, setCommunityActionDialogOpen] = useState(false);
  const [reportActionDialogOpen, setReportActionDialogOpen] = useState(false);
  const { toast } = useToast();

  // Query for admin dashboard stats
  const { data: adminStats, isLoading: statsLoading, refetch: refetchStats } = useQuery<AdminStats>({
    queryKey: ['/api/admin/stats'],
    queryFn: async () => {
      const response = await fetch('/api/admin/stats');
      if (!response.ok) {
        throw new Error('Failed to fetch admin stats');
      }
      return response.json();
    },
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 0, // Consider data always stale to ensure fresh data
  });

  // Query for users list
  const { data: users, isLoading: usersLoading, refetch: refetchUsers } = useQuery<User[]>({
    queryKey: ['/api/admin/users'],
    queryFn: async () => {
      console.log('Fetching users for admin dashboard');
      const response = await fetch('/api/admin/users');
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Admin user fetch error:', response.status, errorText);
        throw new Error(`Failed to fetch users: ${response.status} ${errorText}`);
      }
      return response.json();
    },
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 0,
    retry: 3,
    enabled: activeTab === 'users',
  });

  // Query for books list
  const { data: books, isLoading: booksLoading, refetch: refetchBooks } = useQuery<Book[]>({
    queryKey: ['/api/admin/books'],
    queryFn: async () => {
      console.log('Fetching books for admin dashboard');
      const response = await fetch('/api/admin/books');
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Admin books fetch error:', response.status, errorText);
        throw new Error(`Failed to fetch books: ${response.status} ${errorText}`);
      }
      return response.json();
    },
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 0,
    retry: 3,
    enabled: activeTab === 'books',
  });

  // Query for communities list
  const { data: communities, isLoading: communitiesLoading, refetch: refetchCommunities } = useQuery<Community[]>({
    queryKey: ['/api/admin/communities'],
    queryFn: async () => {
      console.log('Fetching communities for admin dashboard');
      const response = await fetch('/api/admin/communities');
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Admin communities fetch error:', response.status, errorText);
        throw new Error(`Failed to fetch communities: ${response.status} ${errorText}`);
      }
      return response.json();
    },
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 0,
    retry: 3,
    enabled: activeTab === 'communities',
  });

  // Query for reports list
  const { data: reports, isLoading: reportsLoading, refetch: refetchReports } = useQuery<UserReport[]>({
    queryKey: ['/api/admin/reports'],
    queryFn: async () => {
      console.log('Fetching reports for admin dashboard');
      const response = await fetch('/api/admin/reports');
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Admin reports fetch error:', response.status, errorText);
        throw new Error(`Failed to fetch reports: ${response.status} ${errorText}`);
      }
      return response.json();
    },
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 0,
    retry: 3,
    enabled: activeTab === 'reports',
  });

  // Set tab from URL hash
  useEffect(() => {
    const hash = window.location.hash.substring(1);
    if (['dashboard', 'users', 'books', 'communities', 'reports'].includes(hash)) {
      setActiveTab(hash);
    }
  }, []);

  // Update URL hash when tab changes
  useEffect(() => {
    window.location.hash = activeTab;
    
    // Trigger data refetch when tab changes
    if (activeTab === 'dashboard') {
      refetchStats();
    } else if (activeTab === 'users') {
      refetchUsers();
    } else if (activeTab === 'books') {
      refetchBooks();
    } else if (activeTab === 'communities') {
      refetchCommunities();
    } else if (activeTab === 'reports') {
      refetchReports();
    }
  }, [activeTab, refetchStats, refetchUsers, refetchBooks, refetchCommunities, refetchReports]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  const handleResetRequest = () => {
    setShowConfirmation(true);
  };

  const handleCancelReset = () => {
    setShowConfirmation(false);
  };

  const handleConfirmReset = async () => {
    try {
      setIsResetting(true);
      await apiRequest('POST', '/api/reset-data');
      
      toast({
        title: "Account reset successful",
        description: "All user accounts have been removed while preserving content data.",
      });
      
      setResetComplete(true);
      setShowConfirmation(false);
      
      // Refresh all stats after reset
      await Promise.all([
        refetchStats(),
        refetchUsers(),
        refetchBooks(),
        refetchCommunities(),
        refetchReports()
      ]);
    } catch (error) {
      console.error('Error resetting data:', error);
      toast({
        variant: "destructive",
        title: "Reset failed",
        description: "There was an error resetting the application data.",
      });
    } finally {
      setIsResetting(false);
    }
  };

  // User management functions
  const openUserActionDialog = (userId: number) => {
    setSelectedUserId(userId);
    setUserActionDialogOpen(true);
  };

  const handleUserAction = async (action: string) => {
    if (!selectedUserId) return;
    
    try {
      let updates = {};
      switch (action) {
        case 'admin':
          updates = { role: 'admin' };
          break;
        case 'user':
          updates = { role: 'user' };
          break;
        case 'suspend':
          updates = { status: 'suspended' };
          break;
        case 'ban':
          updates = { status: 'banned' };
          break;
        case 'activate':
          updates = { status: 'active' };
          break;
        default:
          return;
      }
      
      await apiRequest('PATCH', `/api/admin/users/${selectedUserId}`, updates);
      
      toast({
        title: "Success",
        description: `User ${action} action completed successfully`,
      });
      
      // Refresh users list
      await refetchUsers();
      await refetchStats();
      
      setUserActionDialogOpen(false);
    } catch (error) {
      console.error('Error updating user:', error);
      toast({
        variant: "destructive",
        title: "Action failed",
        description: "There was an error updating the user.",
      });
    }
  };

  // Book management functions
  const openBookActionDialog = (bookId: number) => {
    setSelectedBookId(bookId);
    setBookActionDialogOpen(true);
  };

  const handleBookAction = async (action: string) => {
    if (!selectedBookId) return;
    
    try {
      if (action === 'unlist') {
        await apiRequest('PATCH', `/api/admin/books/${selectedBookId}`, { unlisted: true });
        toast({
          title: "Success",
          description: "Book has been unlisted",
        });
      } else if (action === 'relist') {
        await apiRequest('PATCH', `/api/admin/books/${selectedBookId}`, { unlisted: false });
        toast({
          title: "Success",
          description: "Book has been relisted",
        });
      } else if (action === 'delete') {
        await apiRequest('DELETE', `/api/admin/books/${selectedBookId}`);
        toast({
          title: "Success",
          description: "Book has been deleted",
        });
      }
      
      // Refresh books list
      await refetchBooks();
      await refetchStats();
      
      setBookActionDialogOpen(false);
    } catch (error) {
      console.error('Error updating book:', error);
      toast({
        variant: "destructive",
        title: "Action failed",
        description: "There was an error updating the book.",
      });
    }
  };

  // Community management functions
  const openCommunityActionDialog = (communityId: number) => {
    setSelectedCommunityId(communityId);
    setCommunityActionDialogOpen(true);
  };

  const handleCommunityAction = async (action: string) => {
    if (!selectedCommunityId) return;
    
    try {
      if (action === 'delete') {
        await apiRequest('DELETE', `/api/admin/communities/${selectedCommunityId}`);
        toast({
          title: "Success",
          description: "Community has been removed and all users unassigned",
        });
      }
      
      // Refresh communities list
      await refetchCommunities();
      await refetchStats();
      
      setCommunityActionDialogOpen(false);
    } catch (error) {
      console.error('Error updating community:', error);
      toast({
        variant: "destructive",
        title: "Action failed",
        description: "There was an error updating the community.",
      });
    }
  };

  // Report management functions
  const openReportActionDialog = (reportId: number) => {
    setSelectedReportId(reportId);
    setReportActionDialogOpen(true);
  };

  const handleReportAction = async (action: string) => {
    if (!selectedReportId) return;
    
    try {
      let newStatus;
      if (action === 'reviewed') {
        newStatus = 'reviewed';
      } else if (action === 'dismissed') {
        newStatus = 'dismissed';
      } else if (action === 'actioned') {
        newStatus = 'actioned';
      } else {
        return;
      }
      
      await apiRequest('PATCH', `/api/admin/reports/${selectedReportId}`, { status: newStatus });
      
      toast({
        title: "Success",
        description: `Report has been marked as ${newStatus}`,
      });
      
      // Refresh reports list
      await refetchReports();
      await refetchStats();
      
      setReportActionDialogOpen(false);
    } catch (error) {
      console.error('Error updating report:', error);
      toast({
        variant: "destructive",
        title: "Action failed",
        description: "There was an error updating the report.",
      });
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        
        <Button 
          variant="destructive" 
          onClick={handleResetRequest}
          disabled={isResetting || resetComplete}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Reset User Accounts
        </Button>
      </div>
      
      {resetComplete && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Success!</AlertTitle>
          <AlertDescription>
            All user account information has been reset while preserving content data. New users will need to register accounts.
          </AlertDescription>
        </Alert>
      )}

      {showConfirmation && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Warning!</AlertTitle>
          <AlertDescription>
            <p>This will delete all user accounts and credentials, but preserve book listings and other content. 
            This action cannot be undone. Are you sure you want to continue?</p>
            <div className="flex justify-end gap-4 mt-4">
              <Button variant="outline" onClick={handleCancelReset}>
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={handleConfirmReset}
                disabled={isResetting}
              >
                {isResetting ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Confirm Reset
                  </>
                )}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid grid-cols-5 mb-8">
          <TabsTrigger value="dashboard" className="flex items-center">
            <BarChart className="h-4 w-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center">
            <Users className="h-4 w-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger value="books" className="flex items-center">
            <BookOpen className="h-4 w-4 mr-2" />
            Books
          </TabsTrigger>
          <TabsTrigger value="communities" className="flex items-center">
            <Home className="h-4 w-4 mr-2" />
            Communities
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center">
            <FileText className="h-4 w-4 mr-2" />
            Reports
          </TabsTrigger>
        </TabsList>

        {/* Dashboard tab content */}
        <TabsContent value="dashboard">
          {statsLoading ? (
            <div className="flex justify-center p-12">
              <RefreshCw className="h-8 w-8 animate-spin" />
            </div>
          ) : adminStats ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Users className="h-5 w-5 mr-2" />
                    Users
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span>Total Accounts:</span>
                      <Badge className="text-lg">{adminStats.users.total}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Active Users:</span>
                      <Badge className="bg-green-600">{adminStats.users.active}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Suspended Users:</span>
                      <Badge className="bg-yellow-600">{adminStats.users.suspended}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Banned Users:</span>
                      <Badge className="bg-red-600">{adminStats.users.banned}</Badge>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={() => setActiveTab('users')}
                  >
                    Manage Users
                  </Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BookOpen className="h-5 w-5 mr-2" />
                    Books
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span>Total Books:</span>
                      <Badge className="text-lg">{adminStats.books.total}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Available Books:</span>
                      <Badge className="bg-green-600">{adminStats.books.available}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Borrowed Books:</span>
                      <Badge className="bg-blue-600">{adminStats.books.borrowed}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Unlisted Books:</span>
                      <Badge className="bg-yellow-600">{adminStats.books.unlisted}</Badge>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => setActiveTab('books')}
                  >
                    Manage Books
                  </Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Home className="h-5 w-5 mr-2" />
                    Communities
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span>Total Communities:</span>
                      <Badge className="text-lg">{adminStats.communities.total}</Badge>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => setActiveTab('communities')}
                  >
                    Manage Communities
                  </Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <FileText className="h-5 w-5 mr-2" />
                    Pending Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span>Pending Borrow Requests:</span>
                      <Badge>{adminStats.requests.pendingBorrows}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Pending User Reports:</span>
                      <Badge className="bg-red-600">{adminStats.requests.pendingReports}</Badge>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => setActiveTab('reports')}
                  >
                    View Reports
                  </Button>
                </CardFooter>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="p-6">
                <p className="text-center text-muted-foreground">Failed to load statistics</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Users tab content */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                View and manage all user accounts. Change roles, ban or suspend users.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex justify-center p-12">
                  <RefreshCw className="h-8 w-8 animate-spin" />
                </div>
              ) : users && users.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Credits</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                {user.avatar ? (
                                  <AvatarImage src={user.avatar} />
                                ) : (
                                  <AvatarFallback>
                                    {user.username.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              <span>{user.username}</span>
                            </div>
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            {user.role === 'admin' ? (
                              <Badge className="bg-purple-600">Admin</Badge>
                            ) : (
                              <Badge variant="outline">User</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {!user.status || user.status === 'active' ? (
                              <Badge className="bg-green-600">Active</Badge>
                            ) : user.status === 'suspended' ? (
                              <Badge className="bg-yellow-600">Suspended</Badge>
                            ) : (
                              <Badge className="bg-red-600">Banned</Badge>
                            )}
                          </TableCell>
                          <TableCell>{formatCredits(user.credits).toFixed(1)}</TableCell>
                          <TableCell>
                            {user.city && user.state ? `${user.city}, ${user.state}` : 'Not set'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => openUserActionDialog(user.id)}
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              ) : (
                <p className="text-center text-muted-foreground p-6">No users found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Books tab content */}
        <TabsContent value="books">
          <Card>
            <CardHeader>
              <CardTitle>Book Management</CardTitle>
              <CardDescription>
                View all books in the system. Unlist or remove problematic content.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {booksLoading ? (
                <div className="flex justify-center p-12">
                  <RefreshCw className="h-8 w-8 animate-spin" />
                </div>
              ) : books && books.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Author</TableHead>
                        <TableHead>Owner</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Genre</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {books.map((book) => (
                        <TableRow key={book.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {book.imageUrl && (
                                <img 
                                  src={book.imageUrl} 
                                  alt={book.title}
                                  className="h-10 w-8 object-cover rounded"
                                />
                              )}
                              <span className="font-medium">{book.title}</span>
                            </div>
                          </TableCell>
                          <TableCell>{book.author}</TableCell>
                          <TableCell>{book.ownerUsername}</TableCell>
                          <TableCell>
                            {book.unlisted ? (
                              <Badge variant="outline" className="border-yellow-600 text-yellow-600">
                                <EyeOff className="h-3 w-3 mr-1" />
                                Unlisted
                              </Badge>
                            ) : book.borrowed ? (
                              <Badge className="bg-blue-600">
                                Borrowed by {book.borrowerUsername}
                              </Badge>
                            ) : (
                              <Badge className="bg-green-600">Available</Badge>
                            )}
                          </TableCell>
                          <TableCell>{book.genre}</TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => openBookActionDialog(book.id)}
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              ) : (
                <p className="text-center text-muted-foreground p-6">No books found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Communities tab content */}
        <TabsContent value="communities">
          <Card>
            <CardHeader>
              <CardTitle>Community Management</CardTitle>
              <CardDescription>
                View and manage all communities. See member counts and remove problematic communities.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {communitiesLoading ? (
                <div className="flex justify-center p-12">
                  <RefreshCw className="h-8 w-8 animate-spin" />
                </div>
              ) : communities && communities.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Creator</TableHead>
                        <TableHead>Members</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {communities.map((community) => (
                        <TableRow key={community.id}>
                          <TableCell className="font-medium">{community.name}</TableCell>
                          <TableCell>{community.location}</TableCell>
                          <TableCell>{community.creatorUsername}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              <Users className="h-3 w-3 mr-1" />
                              {community.memberCount || 0}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {community.isPublic ? (
                              <Badge className="bg-green-600">Public</Badge>
                            ) : (
                              <Badge variant="outline">Private</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => openCommunityActionDialog(community.id)}
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              ) : (
                <p className="text-center text-muted-foreground p-6">No communities found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports tab content */}
        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>User Reports</CardTitle>
              <CardDescription>
                Review and take action on user reports.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reportsLoading ? (
                <div className="flex justify-center p-12">
                  <RefreshCw className="h-8 w-8 animate-spin" />
                </div>
              ) : reports && reports.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Reported User</TableHead>
                        <TableHead>Reporter</TableHead>
                        <TableHead>Related Book</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reports.map((report) => (
                        <TableRow key={report.id}>
                          <TableCell>
                            <Badge className="bg-red-600 capitalize">
                              {report.reportType.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>{report.reportedUsername}</TableCell>
                          <TableCell>{report.reporterUsername}</TableCell>
                          <TableCell>{report.bookTitle || 'N/A'}</TableCell>
                          <TableCell>
                            {report.status === 'pending' ? (
                              <Badge className="bg-yellow-600">Pending</Badge>
                            ) : report.status === 'reviewed' ? (
                              <Badge className="bg-blue-600">Reviewed</Badge>
                            ) : report.status === 'dismissed' ? (
                              <Badge variant="outline">Dismissed</Badge>
                            ) : (
                              <Badge className="bg-green-600">Actioned</Badge>
                            )}
                          </TableCell>
                          <TableCell>{new Date(report.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => openReportActionDialog(report.id)}
                              >
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              ) : (
                <p className="text-center text-muted-foreground p-6">No reports found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* User action dialog */}
      <Dialog open={userActionDialogOpen} onOpenChange={setUserActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>User Actions</DialogTitle>
            <DialogDescription>
              Select an action to perform on this user.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Button 
              variant="outline" 
              className="justify-start"
              onClick={() => handleUserAction('admin')}
            >
              <Shield className="h-4 w-4 mr-2" />
              Make Admin
            </Button>
            <Button 
              variant="outline" 
              className="justify-start"
              onClick={() => handleUserAction('user')}
            >
              <User className="h-4 w-4 mr-2" />
              Remove Admin Rights
            </Button>
            <Separator />
            <Button 
              variant="outline" 
              className="justify-start"
              onClick={() => handleUserAction('suspend')}
            >
              <Ban className="h-4 w-4 mr-2" />
              Suspend User
            </Button>
            <Button 
              variant="outline" 
              className="justify-start text-red-600 hover:text-red-600"
              onClick={() => handleUserAction('ban')}
            >
              <UserX className="h-4 w-4 mr-2" />
              Ban User
            </Button>
            <Button 
              variant="outline" 
              className="justify-start text-green-600 hover:text-green-600"
              onClick={() => handleUserAction('activate')}
            >
              <Check className="h-4 w-4 mr-2" />
              Activate User
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserActionDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Book action dialog */}
      <Dialog open={bookActionDialogOpen} onOpenChange={setBookActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Book Actions</DialogTitle>
            <DialogDescription>
              Select an action to perform on this book.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Button 
              variant="outline" 
              className="justify-start"
              onClick={() => handleBookAction('unlist')}
            >
              <EyeOff className="h-4 w-4 mr-2" />
              Unlist Book
            </Button>
            <Button 
              variant="outline" 
              className="justify-start"
              onClick={() => handleBookAction('relist')}
            >
              <Eye className="h-4 w-4 mr-2" />
              Relist Book
            </Button>
            <Separator />
            <Button 
              variant="outline" 
              className="justify-start text-red-600 hover:text-red-600"
              onClick={() => handleBookAction('delete')}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Book
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBookActionDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Community action dialog */}
      <Dialog open={communityActionDialogOpen} onOpenChange={setCommunityActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Community Actions</DialogTitle>
            <DialogDescription>
              Select an action to perform on this community.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Button 
              variant="outline" 
              className="justify-start text-red-600 hover:text-red-600"
              onClick={() => handleCommunityAction('delete')}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Community
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommunityActionDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report action dialog */}
      <Dialog open={reportActionDialogOpen} onOpenChange={setReportActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Actions</DialogTitle>
            <DialogDescription>
              Select an action to perform on this report.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Button 
              variant="outline" 
              className="justify-start"
              onClick={() => handleReportAction('reviewed')}
            >
              <Eye className="h-4 w-4 mr-2" />
              Mark as Reviewed
            </Button>
            <Button 
              variant="outline" 
              className="justify-start"
              onClick={() => handleReportAction('dismissed')}
            >
              <X className="h-4 w-4 mr-2" />
              Dismiss Report
            </Button>
            <Button 
              variant="outline" 
              className="justify-start text-green-600 hover:text-green-600"
              onClick={() => handleReportAction('actioned')}
            >
              <Check className="h-4 w-4 mr-2" />
              Mark as Actioned
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportActionDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}