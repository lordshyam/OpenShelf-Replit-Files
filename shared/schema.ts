import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  credits: integer("credits").notNull().default(0),
  verified: boolean("verified").default(false),
  verificationCode: text("verification_code"),
  preferences: jsonb("preferences").$type<{
    genres: string[];
    formats: string[];
    languages: string[];
  }>(),
});

// Enhanced validation for user registration
export const insertUserSchema = createInsertSchema(users)
  .pick({
    username: true,
    email: true,
    password: true,
  })
  .extend({
    username: z.string()
      .min(3, "Username must be at least 3 characters")
      .max(30, "Username must be less than 30 characters")
      .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers and underscores"),
    email: z.string()
      .email("Please enter a valid email address")
      .refine(email => email.endsWith('@gmail.com'), "Only Gmail addresses are allowed"),
    password: z.string()
      .min(6, "Password must be at least 6 characters long")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
  });

// Schema for verifying email
export const verifyEmailSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6, "Verification code must be 6 characters"),
});

export const books = pgTable("books", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  author: text("author").notNull(),
  description: text("description"),
  googleBooksId: text("google_books_id"),
  ownerId: integer("owner_id").notNull(),
  borrowed: boolean("borrowed").default(false),
  borrowerId: integer("borrower_id"),
  borrowDeadline: timestamp("borrow_deadline"),
  condition: text("condition"),
  genre: text("genre").notNull(),
  imageUrl: text("image_url"),
  donated: boolean("donated").default(false),
});

export const borrowRequests = pgTable("borrowRequests", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id").notNull(),
  requesterId: integer("requester_id").notNull(),
  status: text("status").notNull().default("pending"), // pending, accepted, declined
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const chats = pgTable("chats", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull(),
  receiverId: integer("receiver_id").notNull(),
  message: text("message").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  bookId: integer("book_id"),
});

export const insertBookSchema = createInsertSchema(books).omit({
  id: true,
  borrowed: true,
  borrowerId: true,
  borrowDeadline: true,
  donated: true,
});

export const insertBorrowRequestSchema = createInsertSchema(borrowRequests).omit({
  id: true,
  status: true,
  createdAt: true,
});

export const insertChatSchema = createInsertSchema(chats).omit({
  id: true,
  timestamp: true,
});

export const userPreferencesSchema = z.object({
  genres: z.array(z.string()),
  formats: z.array(z.string()),
  languages: z.array(z.string()),
});

// Available book genres
export const bookGenres = [
  "Fiction",
  "Non-Fiction",
  "Mystery",
  "Science Fiction",
  "Fantasy",
  "Romance",
  "Thriller",
  "Horror",
  "Biography",
  "History",
  "Science",
  "Technology",
  "Self-Help",
  "Children's",
  "Young Adult",
  "Poetry",
  "Drama",
  "Religion",
  "Philosophy",
  "Art",
] as const;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertBook = z.infer<typeof insertBookSchema>;
export type InsertBorrowRequest = z.infer<typeof insertBorrowRequestSchema>;
export type InsertChat = z.infer<typeof insertChatSchema>;
export type User = typeof users.$inferSelect;
export type Book = typeof books.$inferSelect;
export type BorrowRequest = typeof borrowRequests.$inferSelect;
export type Chat = typeof chats.$inferSelect;
export type UserPreferences = z.infer<typeof userPreferencesSchema>;