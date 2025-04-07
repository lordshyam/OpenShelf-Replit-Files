import { 
  User, Book, Chat, BorrowRequest, InsertUser, InsertBook, 
  InsertChat, InsertBorrowRequest, UserPreferences, Community, 
  CommunityJoinRequest, CommunityChat, InsertCommunity, 
  InsertCommunityJoinRequest, InsertCommunityChat, UserReport,
  InsertUserReport
} from "@shared/schema";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";
import { db, pool, executeDbOperation } from "./db";
import { getRandomAvatar } from "@shared/avatars";
import session from "express-session";
import memorystore from "memorystore";

// Create the memory store for session management
const MemoryStore = memorystore(session);

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
  
  // User reports
  getUserReports(): Promise<UserReport[]>;
  getUserReportsByReporter(reporterId: number): Promise<UserReport[]>;
  getUserReportsByReported(reportedUserId: number): Promise<UserReport[]>;
  createUserReport(report: InsertUserReport): Promise<UserReport>;
  updateUserReportStatus(id: number, status: string): Promise<void>;

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

  sessionStore: any; // Use 'any' for the session store to avoid type issues
}

export class MemStorage implements IStorage {
  private users!: Map<number, User>;
  private books!: Map<number, Book>;
  private chats!: Map<number, Chat>;
  private borrowRequests!: Map<number, BorrowRequest>;
  private communities!: Map<number, Community>;
  private communityJoinRequests!: Map<number, CommunityJoinRequest>;
  private communityChats!: Map<number, CommunityChat>;
  private userReports!: Map<number, UserReport>;
  private currentId!: number;
  sessionStore!: any; // Use 'any' for the session store to avoid type issues

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
    
    // Clear all user reports
    this.userReports = new Map();
    
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
    console.log("Performing complete memory storage reset for ALL data...");
    this.users = new Map();
    this.books = new Map();
    this.chats = new Map();
    this.borrowRequests = new Map();
    this.communities = new Map();
    this.communityJoinRequests = new Map();
    this.communityChats = new Map();
    this.userReports = new Map();
    this.currentId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
    console.log("Memory storage reset complete.");
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
      state: insertCommunity.state || null,
      city: insertCommunity.city || null,
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
      communityId: null,
      state: null,
      city: null,
      locationVerified: false
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

  // User Report methods
  async getUserReports(): Promise<UserReport[]> {
    return Array.from(this.userReports.values());
  }

  async getUserReportsByReporter(reporterId: number): Promise<UserReport[]> {
    return Array.from(this.userReports.values()).filter(
      (report) => report.reporterId === reporterId
    );
  }

  async getUserReportsByReported(reportedUserId: number): Promise<UserReport[]> {
    return Array.from(this.userReports.values()).filter(
      (report) => report.reportedUserId === reportedUserId
    );
  }

  async createUserReport(report: InsertUserReport): Promise<UserReport> {
    const id = this.currentId++;
    const userReport: UserReport = {
      id,
      reporterId: report.reporterId,
      reportedUserId: report.reportedUserId,
      reportType: report.reportType,
      description: report.description,
      bookId: report.bookId || null,
      chatId: report.chatId || null,
      status: "pending",
      createdAt: new Date(),
      resolvedAt: null,
    };
    this.userReports.set(id, userReport);
    return userReport;
  }

  async updateUserReportStatus(id: number, status: string): Promise<void> {
    const report = this.userReports.get(id);
    if (!report) throw new Error("User report not found");
    
    const updates: Partial<UserReport> = { status };
    // If the status is not pending, we're resolving the report
    if (status !== "pending") {
      updates.resolvedAt = new Date();
    }
    
    const updatedReport = { ...report, ...updates };
    this.userReports.set(id, updatedReport);
  }
}

export class DbStorage implements IStorage {
  sessionStore: any;
  private isDbConnected: boolean = false;
  private connectionRetries: number = 0;
  private maxRetries: number = 5;
  
  constructor() {
    // Initialize the session store
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    });
    
    // Check database connection on startup
    this.checkConnection();
    
    // Set up periodic connection health checks
    setInterval(() => this.checkConnection(), 60000); // Check every minute
  }
  
  private async checkConnection(): Promise<void> {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      
      if (!this.isDbConnected) {
        console.log('Database connection established');
        this.isDbConnected = true;
        this.connectionRetries = 0;
      }
    } catch (error) {
      this.isDbConnected = false;
      this.connectionRetries++;
      
      console.error(`Database connection check failed (attempt ${this.connectionRetries}/${this.maxRetries}):`, error);
      
      if (this.connectionRetries >= this.maxRetries) {
        console.error('Maximum database connection retries reached. Please check database configuration.');
      }
    }
  }

  async resetAllData(): Promise<void> {
    // This method is only implemented for compatibility with the IStorage interface
    // In a production database, we don't want to accidentally delete all data
    console.log("Reset all data is not supported in DbStorage as it would delete all database records");
    
    // For development purposes, provide information about database resets
    if (process.env.NODE_ENV === 'development') {
      console.log("To reset data in development, run the migration script with the '--reset' flag");
    }
  }

  resetEverything(): void {
    // This method is only implemented for compatibility with the IStorage interface
    // In a production database, we don't want to accidentally delete all data
    console.log("Reset everything is not supported in DbStorage as it would delete all database records");
    
    // For development purposes, provide a way to reset the database through a controlled method
    if (process.env.NODE_ENV === 'development') {
      console.log("If you need to reset the database in development, run the migration script again");
    }
  }

  // User operations
  async getUsers(): Promise<User[]> {
    try {
      return await db.select().from(schema.users);
    } catch (error) {
      console.error("Error fetching users:", error);
      return [];
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    return await executeDbOperation(
      async () => {
        const result = await db.select().from(schema.users).where(eq(schema.users.id, id));
        return result[0];
      },
      `Error fetching user ${id}`
    ).catch(error => {
      console.error(`Error fetching user ${id}:`, error);
      return undefined;
    });
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const result = await db.select().from(schema.users).where(eq(schema.users.username, username));
      return result[0];
    } catch (error) {
      console.error(`Error fetching user by username ${username}:`, error);
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const result = await db.select().from(schema.users).where(eq(schema.users.email, email));
      return result[0];
    } catch (error) {
      console.error(`Error fetching user by email ${email}:`, error);
      return undefined;
    }
  }

  async createUser(user: InsertUser): Promise<User> {
    return await executeDbOperation(
      async () => {
        // Convert property names to snake_case for database columns
        const dbUser: any = {
          username: user.username,
          email: user.email,
          password: user.password,
          credits: 0, // Default credits for new users
          verified: user.verified || false,
          verification_code: user.verificationCode || null,
          avatar: user.avatar || getRandomAvatar(),
          community_id: user.communityId || null,
          state: user.state || null,
          city: user.city || null,
          location_verified: user.locationVerified || false,
          preferences: user.preferences || null
        };
        
        const result = await db.insert(schema.users).values(dbUser).returning();
        return result[0];
      },
      "Error creating user"
    );
  }

  async updateUser(id: number, updates: Partial<User>): Promise<void> {
    try {
      // Convert camelCase properties to snake_case for database columns
      const dbUpdates: any = {};
      
      if (updates.username !== undefined) dbUpdates.username = updates.username;
      if (updates.email !== undefined) dbUpdates.email = updates.email;
      if (updates.password !== undefined) dbUpdates.password = updates.password;
      if (updates.credits !== undefined) dbUpdates.credits = updates.credits;
      if (updates.verified !== undefined) dbUpdates.verified = updates.verified;
      if (updates.verificationCode !== undefined) dbUpdates.verification_code = updates.verificationCode;
      if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar;
      if (updates.communityId !== undefined) dbUpdates.community_id = updates.communityId;
      if (updates.state !== undefined) dbUpdates.state = updates.state;
      if (updates.city !== undefined) dbUpdates.city = updates.city;
      if (updates.locationVerified !== undefined) dbUpdates.location_verified = updates.locationVerified;
      if (updates.preferences !== undefined) dbUpdates.preferences = updates.preferences;
      
      // Only update if there are changes to make
      if (Object.keys(dbUpdates).length > 0) {
        await db.update(schema.users)
          .set(dbUpdates)
          .where(eq(schema.users.id, id));
      }
    } catch (error) {
      console.error(`Error updating user ${id}:`, error);
      throw error;
    }
  }

  async updateUserCredits(userId: number, credits: number): Promise<void> {
    try {
      await db.update(schema.users)
        .set({ credits })
        .where(eq(schema.users.id, userId));
    } catch (error) {
      console.error(`Error updating credits for user ${userId}:`, error);
      throw error;
    }
  }

  async updateUserPreferences(userId: number, preferences: UserPreferences): Promise<void> {
    try {
      await db.update(schema.users)
        .set({ preferences })
        .where(eq(schema.users.id, userId));
    } catch (error) {
      console.error(`Error updating preferences for user ${userId}:`, error);
      throw error;
    }
  }

  async deleteUser(id: number): Promise<void> {
    try {
      await db.delete(schema.users)
        .where(eq(schema.users.id, id));
    } catch (error) {
      console.error(`Error deleting user ${id}:`, error);
      throw error;
    }
  }

  // User reports
  async getUserReports(): Promise<UserReport[]> {
    try {
      return await db.select().from(schema.userReports);
    } catch (error) {
      console.error("Error fetching user reports:", error);
      return [];
    }
  }

  async getUserReportsByReporter(reporterId: number): Promise<UserReport[]> {
    try {
      return await db.select().from(schema.userReports).where(eq(schema.userReports.reporterId, reporterId));
    } catch (error) {
      console.error(`Error fetching reports by reporter ${reporterId}:`, error);
      return [];
    }
  }

  async getUserReportsByReported(reportedUserId: number): Promise<UserReport[]> {
    try {
      return await db.select().from(schema.userReports).where(eq(schema.userReports.reportedUserId, reportedUserId));
    } catch (error) {
      console.error(`Error fetching reports for reported user ${reportedUserId}:`, error);
      return [];
    }
  }

  async createUserReport(report: InsertUserReport): Promise<UserReport> {
    try {
      // Convert property names to snake_case for database columns
      const dbReport: any = {
        reporter_id: report.reporterId,
        reported_user_id: report.reportedUserId,
        report_type: report.reportType,
        description: report.description,
        book_id: report.bookId,
        chat_id: report.chatId,
        status: report.status || 'pending',
        created_at: report.createdAt || new Date()
      };
      
      const result = await db.insert(schema.userReports).values(dbReport).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating user report:", error);
      throw error;
    }
  }

  async updateUserReportStatus(id: number, status: string): Promise<void> {
    try {
      // Convert camelCase properties to snake_case for database columns
      const dbUpdates: any = { 
        status,
        resolved_at: status !== 'pending' ? new Date() : undefined
      };
      
      await db.update(schema.userReports)
        .set(dbUpdates)
        .where(eq(schema.userReports.id, id));
    } catch (error) {
      console.error(`Error updating report status ${id}:`, error);
      throw error;
    }
  }

  // Book operations
  async getBooks(): Promise<Book[]> {
    try {
      return await db.select().from(schema.books);
    } catch (error) {
      console.error("Error fetching books:", error);
      return [];
    }
  }

  async getBooksByOwner(ownerId: number): Promise<Book[]> {
    try {
      return await db.select().from(schema.books).where(eq(schema.books.ownerId, ownerId));
    } catch (error) {
      console.error(`Error fetching books by owner ${ownerId}:`, error);
      return [];
    }
  }

  async getBooksByBorrower(borrowerId: number): Promise<Book[]> {
    try {
      return await db.select().from(schema.books).where(eq(schema.books.borrowerId, borrowerId));
    } catch (error) {
      console.error(`Error fetching books by borrower ${borrowerId}:`, error);
      return [];
    }
  }

  async getBooksByCommunity(communityId: number): Promise<Book[]> {
    try {
      return await db.select().from(schema.books).where(eq(schema.books.communityId, communityId));
    } catch (error) {
      console.error(`Error fetching books by community ${communityId}:`, error);
      return [];
    }
  }

  async createBook(book: InsertBook): Promise<Book> {
    try {
      // Convert property names to snake_case for database columns
      const dbBook: any = {
        title: book.title,
        author: book.author,
        description: book.description,
        google_books_id: book.googleBooksId,
        owner_id: book.ownerId,
        community_id: book.communityId,
        condition: book.condition,
        genre: book.genre,
        image_url: book.imageUrl,
        unlisted: book.unlisted
      };
      
      const result = await db.insert(schema.books).values(dbBook).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating book:", error);
      throw error;
    }
  }

  async updateBook(id: number, updates: Partial<Book>): Promise<Book> {
    try {
      // Convert camelCase properties to snake_case for database columns
      const dbUpdates: any = {};
      
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.author !== undefined) dbUpdates.author = updates.author;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.googleBooksId !== undefined) dbUpdates.google_books_id = updates.googleBooksId;
      if (updates.ownerId !== undefined) dbUpdates.owner_id = updates.ownerId;
      if (updates.communityId !== undefined) dbUpdates.community_id = updates.communityId;
      if (updates.borrowed !== undefined) dbUpdates.borrowed = updates.borrowed;
      if (updates.borrowerId !== undefined) dbUpdates.borrower_id = updates.borrowerId;
      if (updates.borrowDeadline !== undefined) dbUpdates.borrow_deadline = updates.borrowDeadline;
      if (updates.returned !== undefined) dbUpdates.returned = updates.returned;
      if (updates.condition !== undefined) dbUpdates.condition = updates.condition;
      if (updates.genre !== undefined) dbUpdates.genre = updates.genre;
      if (updates.imageUrl !== undefined) dbUpdates.image_url = updates.imageUrl;
      if (updates.donated !== undefined) dbUpdates.donated = updates.donated;
      if (updates.unlisted !== undefined) dbUpdates.unlisted = updates.unlisted;
      
      const result = await db.update(schema.books).set(dbUpdates).where(eq(schema.books.id, id)).returning();
      return result[0];
    } catch (error) {
      console.error(`Error updating book ${id}:`, error);
      throw error;
    }
  }

  async deleteBook(id: number): Promise<void> {
    try {
      await db.delete(schema.books)
        .where(eq(schema.books.id, id));
    } catch (error) {
      console.error(`Error deleting book ${id}:`, error);
      throw error;
    }
  }

  // Community operations
  async getCommunities(): Promise<Community[]> {
    try {
      return await db.select().from(schema.communities);
    } catch (error) {
      console.error("Error fetching communities:", error);
      return [];
    }
  }

  async getCommunity(id: number): Promise<Community | undefined> {
    try {
      const result = await db.select().from(schema.communities).where(eq(schema.communities.id, id));
      return result[0];
    } catch (error) {
      console.error(`Error fetching community ${id}:`, error);
      return undefined;
    }
  }

  async createCommunity(community: InsertCommunity): Promise<Community> {
    try {
      // Convert property names to snake_case for database columns
      const dbCommunity: any = {
        name: community.name,
        description: community.description,
        location: community.location,
        state: community.state,
        city: community.city,
        image_url: community.imageUrl,
        is_public: community.isPublic,
        created_at: community.createdAt || new Date(),
        created_by: community.createdBy
      };
      
      const result = await db.insert(schema.communities).values(dbCommunity).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating community:", error);
      throw error;
    }
  }

  async updateCommunity(id: number, updates: Partial<Community>): Promise<void> {
    try {
      // Convert camelCase properties to snake_case for database columns
      const dbUpdates: any = {};
      
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.location !== undefined) dbUpdates.location = updates.location;
      if (updates.state !== undefined) dbUpdates.state = updates.state;
      if (updates.city !== undefined) dbUpdates.city = updates.city;
      if (updates.imageUrl !== undefined) dbUpdates.image_url = updates.imageUrl;
      if (updates.isPublic !== undefined) dbUpdates.is_public = updates.isPublic;
      if (updates.createdAt !== undefined) dbUpdates.created_at = updates.createdAt;
      if (updates.createdBy !== undefined) dbUpdates.created_by = updates.createdBy;
      
      // Only update if there are changes to make
      if (Object.keys(dbUpdates).length > 0) {
        await db.update(schema.communities)
          .set(dbUpdates)
          .where(eq(schema.communities.id, id));
      }
    } catch (error) {
      console.error(`Error updating community ${id}:`, error);
      throw error;
    }
  }

  async getCommunityMembers(communityId: number): Promise<User[]> {
    try {
      return await db.select().from(schema.users).where(eq(schema.users.communityId, communityId));
    } catch (error) {
      console.error(`Error fetching community members for community ${communityId}:`, error);
      return [];
    }
  }

  // Community join requests
  async getJoinRequests(communityId: number): Promise<CommunityJoinRequest[]> {
    try {
      return await db.select().from(schema.communityJoinRequests).where(eq(schema.communityJoinRequests.communityId, communityId));
    } catch (error) {
      console.error(`Error fetching join requests for community ${communityId}:`, error);
      return [];
    }
  }

  async createJoinRequest(request: InsertCommunityJoinRequest): Promise<CommunityJoinRequest> {
    try {
      // Convert property names to snake_case for database columns
      const dbRequest: any = {
        user_id: request.userId,
        community_id: request.communityId,
        status: request.status || 'pending',
        created_at: request.createdAt || new Date()
      };
      
      const result = await db.insert(schema.communityJoinRequests).values(dbRequest).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating join request:", error);
      throw error;
    }
  }

  async updateJoinRequest(id: number, status: string): Promise<void> {
    try {
      await db.update(schema.communityJoinRequests)
        .set({ status })
        .where(eq(schema.communityJoinRequests.id, id));
    } catch (error) {
      console.error(`Error updating join request ${id}:`, error);
      throw error;
    }
  }

  // Community chat
  async getCommunityChats(communityId: number): Promise<CommunityChat[]> {
    try {
      return await db.select().from(schema.communityChats).where(eq(schema.communityChats.communityId, communityId));
    } catch (error) {
      console.error(`Error fetching chats for community ${communityId}:`, error);
      return [];
    }
  }

  async createCommunityChat(chat: InsertCommunityChat): Promise<CommunityChat> {
    try {
      // Convert property names to snake_case for database columns
      const dbChat: any = {
        community_id: chat.communityId,
        user_id: chat.userId,
        message: chat.message,
        timestamp: chat.timestamp || new Date()
      };
      
      const result = await db.insert(schema.communityChats).values(dbChat).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating community chat:", error);
      throw error;
    }
  }

  // Borrow requests
  async getBorrowRequests(userId: number): Promise<BorrowRequest[]> {
    try {
      return await db.select().from(schema.borrowRequests).where(eq(schema.borrowRequests.requesterId, userId));
    } catch (error) {
      console.error(`Error fetching borrow requests for user ${userId}:`, error);
      return [];
    }
  }

  async createBorrowRequest(request: InsertBorrowRequest): Promise<BorrowRequest> {
    try {
      // Convert property names to snake_case for database columns
      const dbRequest: any = {
        book_id: request.bookId,
        requester_id: request.requesterId,
        status: request.status || 'pending',
        created_at: request.createdAt || new Date(),
        requested_return_date: request.requestedReturnDate
      };
      
      const result = await db.insert(schema.borrowRequests).values(dbRequest).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating borrow request:", error);
      throw error;
    }
  }

  async updateBorrowRequest(id: number, status: string): Promise<void> {
    try {
      await db.update(schema.borrowRequests)
        .set({ status })
        .where(eq(schema.borrowRequests.id, id));
    } catch (error) {
      console.error(`Error updating borrow request ${id}:`, error);
      throw error;
    }
  }

  // Chat operations
  async getChats(userId: number): Promise<Chat[]> {
    try {
      // Get chats where the user is either the sender or receiver
      const sentChats = await db.select().from(schema.chats).where(eq(schema.chats.senderId, userId));
      const receivedChats = await db.select().from(schema.chats).where(eq(schema.chats.receiverId, userId));
      return [...sentChats, ...receivedChats];
    } catch (error) {
      console.error(`Error fetching chats for user ${userId}:`, error);
      return [];
    }
  }

  async createChat(chat: InsertChat): Promise<Chat> {
    try {
      // Convert property names to snake_case for database columns
      const dbChat: any = {
        sender_id: chat.senderId,
        receiver_id: chat.receiverId,
        message: chat.message,
        timestamp: chat.timestamp || new Date(),
        book_id: chat.bookId
      };
      
      const result = await db.insert(schema.chats).values(dbChat).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating chat:", error);
      throw error;
    }
  }

  // No need for getter as sessionStore is already public
}

// Use DbStorage for persistent storage
export const storage = new DbStorage();