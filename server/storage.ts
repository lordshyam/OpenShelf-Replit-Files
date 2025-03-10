import { User, Book, Chat, BorrowRequest, InsertUser, InsertBook, InsertChat, InsertBorrowRequest, UserPreferences } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;  // New function
  createUser(user: InsertUser): Promise<User>;
  updateUserCredits(userId: number, credits: number): Promise<void>;
  updateUserPreferences(userId: number, preferences: UserPreferences): Promise<void>;

  // Book operations
  getBooks(): Promise<Book[]>;
  getBooksByOwner(ownerId: number): Promise<Book[]>;
  getBooksByBorrower(borrowerId: number): Promise<Book[]>;
  createBook(book: InsertBook): Promise<Book>;
  updateBook(id: number, updates: Partial<Book>): Promise<Book>;
  deleteBook(id: number): Promise<void>;

  // Borrow request operations
  getBorrowRequests(userId: number): Promise<BorrowRequest[]>;
  createBorrowRequest(request: InsertBorrowRequest): Promise<BorrowRequest>;
  updateBorrowRequest(id: number, status: string): Promise<void>;

  // Chat operations
  getChats(userId: number): Promise<Chat[]>;
  createChat(chat: InsertChat): Promise<Chat>;

  sessionStore: session.SessionStore;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private books: Map<number, Book>;
  private chats: Map<number, Chat>;
  private borrowRequests: Map<number, BorrowRequest>;
  private currentId: number;
  sessionStore: session.SessionStore;

  constructor() {
    this.users = new Map();
    this.books = new Map();
    this.chats = new Map();
    this.borrowRequests = new Map();
    this.currentId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
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
    const user: User = { ...insertUser, id, credits: 0, preferences: null };
    this.users.set(id, user);
    return user;
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
      borrowed: false,
      borrowerId: null,
      borrowDeadline: null,
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
      timestamp: new Date(),
    };
    this.chats.set(id, chat);
    return chat;
  }
}

export const storage = new MemStorage();