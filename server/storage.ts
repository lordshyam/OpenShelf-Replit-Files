import { User, Book, Chat, BorrowRequest, InsertUser, InsertBook, InsertChat, InsertBorrowRequest, UserPreferences, Community, CommunityJoinRequest, CommunityChat, InsertCommunity, InsertCommunityJoinRequest, InsertCommunityChat } from "@shared/schema";
import { getRandomAvatar } from "@shared/avatars";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  // User operations
  getUsers(): Promise<User[]>;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<void>;
  updateUserCredits(userId: number, credits: number): Promise<void>;
  updateUserPreferences(userId: number, preferences: UserPreferences): Promise<void>;
  deleteUser(id: number): Promise<void>;

  // Book operations
  getBooks(): Promise<Book[]>;
  getBooksByOwner(ownerId: number): Promise<Book[]>;
  getBooksByBorrower(borrowerId: number): Promise<Book[]>;
  getBooksByCommunity(communityId: number): Promise<Book[]>;
  createBook(book: InsertBook): Promise<Book>;
  updateBook(id: number, updates: Partial<Book>): Promise<Book>;
  deleteBook(id: number): Promise<void>;

  // Community operations
  getCommunities(): Promise<Community[]>;
  getCommunity(id: number): Promise<Community | undefined>;
  createCommunity(community: InsertCommunity): Promise<Community>;
  updateCommunity(id: number, updates: Partial<Community>): Promise<void>;
  getCommunityMembers(communityId: number): Promise<User[]>;

  // Community join requests
  getJoinRequests(communityId: number): Promise<CommunityJoinRequest[]>;
  createJoinRequest(request: InsertCommunityJoinRequest): Promise<CommunityJoinRequest>;
  updateJoinRequest(id: number, status: string): Promise<void>;

  // Community chat
  getCommunityChats(communityId: number): Promise<CommunityChat[]>;
  createCommunityChat(chat: InsertCommunityChat): Promise<CommunityChat>;

  // Existing operations remain unchanged
  getBorrowRequests(userId: number): Promise<BorrowRequest[]>;
  createBorrowRequest(request: InsertBorrowRequest): Promise<BorrowRequest>;
  updateBorrowRequest(id: number, status: string): Promise<void>;
  getChats(userId: number): Promise<Chat[]>;
  createChat(chat: InsertChat): Promise<Chat>;
  
  // Data management
  resetAllData(): void;
  resetEverything(): void;

  sessionStore: ReturnType<typeof createMemoryStore>;
}

export class MemStorage implements IStorage {
  private users!: Map<number, User>;
  private books!: Map<number, Book>;
  private chats!: Map<number, Chat>;
  private borrowRequests!: Map<number, BorrowRequest>;
  private communities!: Map<number, Community>;
  private communityJoinRequests!: Map<number, CommunityJoinRequest>;
  private communityChats!: Map<number, CommunityChat>;
  private currentId!: number;
  sessionStore!: ReturnType<typeof createMemoryStore>;

  constructor() {
    this.resetAllData();
  }
  
  resetAllData(): void {
    console.log("Performing complete memory storage reset for user data...");
    
    // Completely reset all user accounts
    this.users = new Map();
    
    // Clear all borrow requests since they're tied to users
    this.borrowRequests = new Map();
    
    // Clear all community join requests since they're tied to users
    this.communityJoinRequests = new Map();
    
    // Initialize maps if they don't exist
    if (!this.books) {
      this.books = new Map();
    }
    
    if (!this.chats) {
      this.chats = new Map();
    }
    
    if (!this.communities) {
      this.communities = new Map();
    }
    
    if (!this.communityChats) {
      this.communityChats = new Map();
    }
    
    // Update books to remove borrower information
    if (this.books && this.books.size > 0) {
      console.log(`Resetting borrow status for ${this.books.size} books...`);
      const books = Array.from(this.books.values());
      for (const book of books) {
        // Keep the book but remove borrower information
        this.books.set(book.id, {
          ...book,
          borrowed: false,
          borrowerId: null,
          borrowDeadline: null
        });
      }
    }
    
    // Reset all community memberships
    if (this.communities && this.communities.size > 0) {
      console.log(`Preserving ${this.communities.size} communities...`);
    }
    
    // Reset session store
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
    
    // Reset currentId to ensure no clashes with existing IDs
    if (!this.currentId) {
      this.currentId = 1;
    }
    
    console.log("Memory storage reset complete.");
  }
  
  // Full reset for development purposes - not used in production
  resetEverything(): void {
    this.users = new Map();
    this.books = new Map();
    this.chats = new Map();
    this.borrowRequests = new Map();
    this.communities = new Map();
    this.communityJoinRequests = new Map();
    this.communityChats = new Map();
    this.currentId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  // Implement new community methods
  async getCommunities(): Promise<Community[]> {
    return Array.from(this.communities.values());
  }

  async getCommunity(id: number): Promise<Community | undefined> {
    return this.communities.get(id);
  }

  async createCommunity(insertCommunity: InsertCommunity): Promise<Community> {
    const id = this.currentId++;
    const community: Community = {
      ...insertCommunity,
      id,
      description: insertCommunity.description || null,
      imageUrl: insertCommunity.imageUrl || null,
      createdAt: new Date(),
    };
    this.communities.set(id, community);
    return community;
  }
  
  async updateCommunity(id: number, updates: Partial<Community>): Promise<void> {
    const community = this.communities.get(id);
    if (!community) throw new Error("Community not found");
    const updatedCommunity = { ...community, ...updates };
    this.communities.set(id, updatedCommunity);
  }

  async getCommunityMembers(communityId: number): Promise<User[]> {
    return Array.from(this.users.values()).filter(
      (user) => user.communityId === communityId
    );
  }

  async getJoinRequests(communityId: number): Promise<CommunityJoinRequest[]> {
    return Array.from(this.communityJoinRequests.values()).filter(
      (request) => request.communityId === communityId
    );
  }

  async createJoinRequest(request: InsertCommunityJoinRequest): Promise<CommunityJoinRequest> {
    const id = this.currentId++;
    const joinRequest: CommunityJoinRequest = {
      ...request,
      id,
      status: "pending",
      createdAt: new Date(),
    };
    this.communityJoinRequests.set(id, joinRequest);
    return joinRequest;
  }

  async updateJoinRequest(id: number, status: string): Promise<void> {
    const request = this.communityJoinRequests.get(id);
    if (!request) throw new Error("Join request not found");
    request.status = status;
    this.communityJoinRequests.set(id, request);
  }

  async getCommunityChats(communityId: number): Promise<CommunityChat[]> {
    return Array.from(this.communityChats.values()).filter(
      (chat) => chat.communityId === communityId
    );
  }

  async createCommunityChat(insertChat: InsertCommunityChat): Promise<CommunityChat> {
    const id = this.currentId++;
    const chat: CommunityChat = {
      ...insertChat,
      id,
      timestamp: new Date(),
    };
    this.communityChats.set(id, chat);
    return chat;
  }

  async getBooksByCommunity(communityId: number): Promise<Book[]> {
    return Array.from(this.books.values()).filter(
      (book) => book.communityId === communityId
    );
  }
  
  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email.toLowerCase() === email.toLowerCase(),
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { 
      ...insertUser, 
      id, 
      credits: 0, 
      preferences: null,
      verified: insertUser.verified || false,
      verificationCode: insertUser.verificationCode || null,
      avatar: getRandomAvatar(),
      communityId: null
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<void> {
    const user = await this.getUser(id);
    if (!user) throw new Error("User not found");
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
  }

  async updateUserCredits(userId: number, credits: number): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");
    user.credits = credits;
    this.users.set(userId, user);
  }

  async updateUserPreferences(userId: number, preferences: UserPreferences): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");
    user.preferences = preferences;
    this.users.set(userId, user);
  }

  async deleteUser(id: number): Promise<void> {
    this.users.delete(id);
  }

  async getBooks(): Promise<Book[]> {
    return Array.from(this.books.values());
  }

  async getBooksByOwner(ownerId: number): Promise<Book[]> {
    return Array.from(this.books.values()).filter(
      (book) => book.ownerId === ownerId,
    );
  }

  async getBooksByBorrower(borrowerId: number): Promise<Book[]> {
    return Array.from(this.books.values()).filter(
      (book) => book.borrowerId === borrowerId,
    );
  }

  async createBook(insertBook: InsertBook): Promise<Book> {
    const id = this.currentId++;
    const book: Book = {
      ...insertBook,
      id,
      communityId: insertBook.communityId || 0, // Default to 0 if not provided
      description: insertBook.description || null,
      googleBooksId: insertBook.googleBooksId || null,
      imageUrl: insertBook.imageUrl || null,
      condition: insertBook.condition || null,
      borrowed: false,
      borrowerId: null,
      borrowDeadline: null,
      returned: false,
      donated: false,
    };
    this.books.set(id, book);
    return book;
  }

  async updateBook(id: number, updates: Partial<Book>): Promise<Book> {
    const book = this.books.get(id);
    if (!book) throw new Error("Book not found");
    const updatedBook = { ...book, ...updates };
    this.books.set(id, updatedBook);
    return updatedBook;
  }

  async deleteBook(id: number): Promise<void> {
    this.books.delete(id);
  }

  async getBorrowRequests(userId: number): Promise<BorrowRequest[]> {
    return Array.from(this.borrowRequests.values()).filter(
      (req) => {
        const book = this.books.get(req.bookId);
        return book && (book.ownerId === userId || req.requesterId === userId);
      }
    );
  }

  async createBorrowRequest(request: InsertBorrowRequest): Promise<BorrowRequest> {
    const id = this.currentId++;
    const borrowRequest: BorrowRequest = {
      ...request,
      id,
      status: "pending",
      createdAt: new Date(),
      requestedReturnDate: request.requestedReturnDate || null,
    };
    this.borrowRequests.set(id, borrowRequest);
    return borrowRequest;
  }

  async updateBorrowRequest(id: number, status: string): Promise<void> {
    const request = this.borrowRequests.get(id);
    if (!request) throw new Error("Borrow request not found");
    request.status = status;
    this.borrowRequests.set(id, request);
  }

  async getChats(userId: number): Promise<Chat[]> {
    return Array.from(this.chats.values()).filter(
      (chat) => chat.senderId === userId || chat.receiverId === userId,
    );
  }

  async createChat(insertChat: InsertChat): Promise<Chat> {
    const id = this.currentId++;
    const chat: Chat = {
      ...insertChat,
      id,
      bookId: insertChat.bookId || null,
      timestamp: new Date(),
    };
    this.chats.set(id, chat);
    return chat;
  }
}

export const storage = new MemStorage();