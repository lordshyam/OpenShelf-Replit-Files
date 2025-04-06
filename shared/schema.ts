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
  avatar: text("avatar"),
  communityId: integer("community_id"),
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
    verified: true,
    verificationCode: true,
  })
  .extend({
    username: z.string()
      .min(3, "Username must be at least 3 characters")
      .max(30, "Username must be less than 30 characters")
      .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers and underscores"),
    email: z.string()
      .email("Please enter a valid email address"),
    password: z.string()
      .min(6, "Password must be at least 6 characters long")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    verified: z.boolean().optional().default(false),
    verificationCode: z.string().nullable().optional(),
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
  communityId: integer("community_id").notNull(),
  borrowed: boolean("borrowed").default(false),
  borrowerId: integer("borrower_id"),
  borrowDeadline: timestamp("borrow_deadline"),
  returned: boolean("returned").default(false),
  condition: text("condition"),
  genre: text("genre").notNull(),
  imageUrl: text("image_url"),
  donated: boolean("donated").default(false),
  unlisted: boolean("unlisted").default(false), // New field to hide a book from public view
});

export const borrowRequests = pgTable("borrowRequests", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id").notNull(),
  requesterId: integer("requester_id").notNull(),
  status: text("status").notNull().default("pending"), // pending, accepted, declined
  createdAt: timestamp("created_at").notNull().defaultNow(),
  requestedReturnDate: timestamp("requested_return_date"),
});

export const chats = pgTable("chats", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull(),
  receiverId: integer("receiver_id").notNull(),
  message: text("message").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  bookId: integer("book_id"),
});

export const communities = pgTable("communities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  location: text("location").notNull(),
  imageUrl: text("image_url"),
  isPublic: boolean("is_public").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: integer("created_by").notNull(),
});

export const communityJoinRequests = pgTable("community_join_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  communityId: integer("community_id").notNull(),
  status: text("status").notNull().default("pending"), // pending, accepted, rejected
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const communityChats = pgTable("community_chats", {
  id: serial("id").primaryKey(),
  communityId: integer("community_id").notNull(),
  userId: integer("user_id").notNull(),
  message: text("message").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const userReports = pgTable("user_reports", {
  id: serial("id").primaryKey(),
  reporterId: integer("reporter_id").notNull(),
  reportedUserId: integer("reported_user_id").notNull(),
  reportType: text("report_type").notNull(), // inappropriate_message, book_damage, not_returned, other
  description: text("description").notNull(),
  bookId: integer("book_id"), // Optional, only if report is about a book
  chatId: integer("chat_id"), // Optional, only if report is about a chat
  status: text("status").notNull().default("pending"), // pending, reviewed, dismissed, actioned
  createdAt: timestamp("created_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const insertBookSchema = createInsertSchema(books).omit({
  id: true,
  borrowed: true,
  borrowerId: true,
  borrowDeadline: true,
  returned: true,
  donated: true,
  unlisted: true,
}).extend({
  communityId: z.number().optional(),
  unlisted: z.boolean().optional().default(false),
  title: z.string().min(1, "Title is required"),
  author: z.string().min(1, "Author name is required"),
  description: z.string().min(1, "Description is required"),
  imageUrl: z.string().min(1, "Book image is required"),
});

export const insertBorrowRequestSchema = createInsertSchema(borrowRequests).omit({
  id: true,
  status: true,
  createdAt: true,
}).extend({
  requestedReturnDate: z.date().optional(),
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

export const insertCommunitySchema = createInsertSchema(communities).omit({
  id: true,
  createdAt: true,
}).extend({
  isPublic: z.boolean().default(true)
});

export const insertCommunityJoinRequestSchema = createInsertSchema(communityJoinRequests).omit({
  id: true,
  status: true,
  createdAt: true,
});

export const insertCommunityChatSchema = createInsertSchema(communityChats).omit({
  id: true,
  timestamp: true,
});

export const insertUserReportSchema = createInsertSchema(userReports).omit({
  id: true,
  status: true,
  createdAt: true,
  resolvedAt: true,
}).extend({
  reportType: z.enum(['inappropriate_message', 'book_damage', 'not_returned', 'not_marking_returned', 'other']),
  description: z.string().min(10, "Please provide a detailed description").max(500, "Description too long"),
});

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
export type InsertCommunity = z.infer<typeof insertCommunitySchema>;
export type InsertCommunityJoinRequest = z.infer<typeof insertCommunityJoinRequestSchema>;
export type InsertCommunityChat = z.infer<typeof insertCommunityChatSchema>;
export type InsertUserReport = z.infer<typeof insertUserReportSchema>;
export type Community = typeof communities.$inferSelect;
export type CommunityJoinRequest = typeof communityJoinRequests.$inferSelect;
export type CommunityChat = typeof communityChats.$inferSelect;
export type UserReport = typeof userReports.$inferSelect;