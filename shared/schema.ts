import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  credits: integer("credits").notNull().default(1),
  preferences: jsonb("preferences").$type<{
    genres: string[];
    formats: string[];
    languages: string[];
  }>(),
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
  location: text("location").notNull(),
  donated: boolean("donated").default(false),
});

export const chats = pgTable("chats", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull(),
  receiverId: integer("receiver_id").notNull(),
  message: text("message").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  bookId: integer("book_id"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertBookSchema = createInsertSchema(books).omit({
  id: true,
  borrowed: true,
  borrowerId: true,
  borrowDeadline: true,
  donated: true,
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

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertBook = z.infer<typeof insertBookSchema>;
export type InsertChat = z.infer<typeof insertChatSchema>;
export type User = typeof users.$inferSelect;
export type Book = typeof books.$inferSelect;
export type Chat = typeof chats.$inferSelect;
export type UserPreferences = z.infer<typeof userPreferencesSchema>;
