import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertBookSchema, userPreferencesSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // User preferences
  app.post("/api/preferences", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const result = userPreferencesSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json(result.error);
    }

    await storage.updateUserPreferences(req.user!.id, result.data);
    res.sendStatus(200);
  });

  // Books
  app.get("/api/books", async (req, res) => {
    const books = await storage.getBooks();
    res.json(books);
  });

  app.post("/api/books", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const result = insertBookSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json(result.error);
    }

    // Check for duplicate books
    const existingBooks = await storage.getBooks();
    const isDuplicate = existingBooks.some(book =>
      book.ownerId === req.user!.id &&
      book.title.toLowerCase() === result.data.title.toLowerCase() &&
      book.author.toLowerCase() === result.data.author.toLowerCase()
    );

    if (isDuplicate) {
      return res.status(400).json({ message: "You have already listed this book" });
    }

    const book = await storage.createBook({
      ...result.data,
      ownerId: req.user!.id,
    });

    // Get current user's books count after adding new book
    const userBooks = await storage.getBooksByOwner(req.user!.id);
    const creditsToAdd = 0.5; // Fixed 0.5 credits per book

    // Update user's credits
    await storage.updateUserCredits(req.user!.id, req.user!.credits + creditsToAdd);

    // Broadcast credit update through WebSocket
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'CREDIT_UPDATE',
          userId: req.user!.id,
          credits: req.user!.credits + creditsToAdd
        }));
      }
    });

    res.status(201).json(book);
  });

  // Borrow requests
  app.get("/api/borrow-requests", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const requests = await storage.getBorrowRequests(req.user!.id);
    res.json(requests);
  });

  app.post("/api/books/:id/borrow", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const bookId = parseInt(req.params.id);
    const book = await storage.getBooks().then(books =>
      books.find(b => b.id === bookId)
    );

    if (!book) return res.status(404).send("Book not found");
    if (book.borrowed) return res.status(400).send("Book already borrowed");
    if (req.user!.credits < 1) return res.status(400).send("Insufficient credits");

    // Create a borrow request
    const request = await storage.createBorrowRequest({
      bookId,
      requesterId: req.user!.id,
    });

    // Send a chat message to the book owner
    const chat = await storage.createChat({
      senderId: req.user!.id,
      receiverId: book.ownerId,
      message: `I would like to borrow "${book.title}". Please review my request.`,
      bookId,
    });

    // Broadcast the chat message
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'CHAT_MESSAGE',
          chat,
          bookTitle: book.title
        }));
      }
    });

    res.status(201).json(request);
  });

  app.post("/api/borrow-requests/:id/accept", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const requestId = parseInt(req.params.id);
    const request = (await storage.getBorrowRequests(req.user!.id))
      .find(r => r.id === requestId);

    if (!request) return res.status(404).send("Request not found");

    const book = await storage.getBooks().then(books =>
      books.find(b => b.id === request.bookId)
    );

    if (!book) return res.status(404).send("Book not found");
    if (book.ownerId !== req.user!.id) return res.status(403).send("Not your book");

    // Update the request status
    await storage.updateBorrowRequest(requestId, "accepted");

    // Update the book status
    await storage.updateBook(book.id, {
      borrowed: true,
      borrowerId: request.requesterId,
      borrowDeadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks
    });

    // Deduct credits from borrower and broadcast update
    const borrower = await storage.getUser(request.requesterId);
    if (borrower) {
      const newCredits = borrower.credits - 1;
      await storage.updateUserCredits(borrower.id, newCredits);

      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'CREDIT_UPDATE',
            userId: borrower.id,
            credits: newCredits
          }));
        }
      });
    }

    // Create a private chat room and notify both users
    const chat = await storage.createChat({
      senderId: req.user!.id,
      receiverId: request.requesterId,
      message: `Your request to borrow "${book.title}" has been accepted! You can now chat here.`,
      bookId: book.id,
    });

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'CHAT_MESSAGE',
          chat,
          bookTitle: book.title
        }));
      }
    });

    res.sendStatus(200);
  });

  app.post("/api/borrow-requests/:id/decline", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const requestId = parseInt(req.params.id);
    const request = (await storage.getBorrowRequests(req.user!.id))
      .find(r => r.id === requestId);

    if (!request) return res.status(404).send("Request not found");

    const book = await storage.getBooks().then(books =>
      books.find(b => b.id === request.bookId)
    );

    if (!book) return res.status(404).send("Book not found");
    if (book.ownerId !== req.user!.id) return res.status(403).send("Not your book");

    // Update the request status
    await storage.updateBorrowRequest(requestId, "declined");

    // Notify the borrower through chat
    const chat = await storage.createChat({
      senderId: req.user!.id,
      receiverId: request.requesterId,
      message: `Your request to borrow "${book.title}" has been declined.`,
      bookId: book.id,
    });

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'CHAT_MESSAGE',
          chat,
          bookTitle: book.title
        }));
      }
    });

    res.sendStatus(200);
  });

  // Chat websocket
  wss.on('connection', (ws) => {
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        const chat = await storage.createChat(message);

        // Broadcast to all clients
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'CHAT_MESSAGE',
              chat,
              bookTitle: "Chat message"
            }));
          }
        });
      } catch (err) {
        console.error('Error processing message:', err);
      }
    });
  });

  return httpServer;
}