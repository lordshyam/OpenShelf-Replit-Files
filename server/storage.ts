import { users, books, chats, borrowRequests, type User, type Book, type Chat, type BorrowRequest, type InsertUser, type InsertBook, type InsertChat, type InsertBorrowRequest, type UserPreferences } from "@shared/schema";
import { db } from "./db";
import { eq, or, and } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<void>;
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

export class DatabaseStorage implements IStorage {
  sessionStore: session.SessionStore;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values({
      ...insertUser,
      email: insertUser.email.toLowerCase(),
      verified: false,
      credits: 0,
    }).returning();
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<void> {
    await db.update(users).set(updates).where(eq(users.id, id));
  }

  async updateUserCredits(userId: number, credits: number): Promise<void> {
    await db.update(users).set({ credits }).where(eq(users.id, userId));
  }

  async updateUserPreferences(userId: number, preferences: UserPreferences): Promise<void> {
    await db.update(users).set({ preferences }).where(eq(users.id, userId));
  }

  async getBooks(): Promise<Book[]> {
    return await db.select().from(books);
  }

  async getBooksByOwner(ownerId: number): Promise<Book[]> {
    return await db.select().from(books).where(eq(books.ownerId, ownerId));
  }

  async getBooksByBorrower(borrowerId: number): Promise<Book[]> {
    return await db.select().from(books).where(eq(books.borrowerId, borrowerId));
  }

  async createBook(insertBook: InsertBook): Promise<Book> {
    const [book] = await db.insert(books).values({
      ...insertBook,
      borrowed: false,
      donated: false,
    }).returning();
    return book;
  }

  async updateBook(id: number, updates: Partial<Book>): Promise<Book> {
    const [book] = await db.update(books)
      .set(updates)
      .where(eq(books.id, id))
      .returning();
    return book;
  }

  async deleteBook(id: number): Promise<void> {
    await db.delete(books).where(eq(books.id, id));
  }

  async getBorrowRequests(userId: number): Promise<BorrowRequest[]> {
    return await db.select()
      .from(borrowRequests)
      .where(
        or(
          eq(borrowRequests.requesterId, userId),
          and(
            eq(books.ownerId, userId),
            eq(books.id, borrowRequests.bookId)
          )
        )
      );
  }

  async createBorrowRequest(request: InsertBorrowRequest): Promise<BorrowRequest> {
    const [borrowRequest] = await db.insert(borrowRequests).values({
      ...request,
      status: "pending",
    }).returning();
    return borrowRequest;
  }

  async updateBorrowRequest(id: number, status: string): Promise<void> {
    await db.update(borrowRequests)
      .set({ status })
      .where(eq(borrowRequests.id, id));
  }

  async getChats(userId: number): Promise<Chat[]> {
    return await db.select()
      .from(chats)
      .where(
        or(
          eq(chats.senderId, userId),
          eq(chats.receiverId, userId)
        )
      );
  }

  async createChat(insertChat: InsertChat): Promise<Chat> {
    const [chat] = await db.insert(chats).values(insertChat).returning();
    return chat;
  }
}

export const storage = new DatabaseStorage();