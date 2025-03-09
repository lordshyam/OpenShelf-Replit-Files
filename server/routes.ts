import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertBookSchema, userPreferencesSchema } from "@shared/schema";
import { zodToJsonSchema } from "zod-to-json-schema";

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
    
    const book = await storage.createBook({
      ...result.data,
      ownerId: req.user!.id,
    });
    
    // Add credits for listing book
    await storage.updateUserCredits(req.user!.id, req.user!.credits + 0.5);
    
    res.status(201).json(book);
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
    
    await storage.updateBook(bookId, {
      borrowed: true,
      borrowerId: req.user!.id,
      borrowDeadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks
    });
    
    await storage.updateUserCredits(req.user!.id, req.user!.credits - 1);
    
    res.sendStatus(200);
  });

  app.post("/api/books/:id/return", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const bookId = parseInt(req.params.id);
    const book = await storage.getBooks().then(books => 
      books.find(b => b.id === bookId)
    );
    
    if (!book) return res.status(404).send("Book not found");
    if (!book.borrowed) return res.status(400).send("Book not borrowed");
    if (book.ownerId !== req.user!.id) return res.status(403).send("Not your book");
    
    await storage.updateBook(bookId, {
      borrowed: false,
      borrowerId: null,
      borrowDeadline: null,
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
            client.send(JSON.stringify(chat));
          }
        });
      } catch (err) {
        console.error('Error processing message:', err);
      }
    });
  });

  return httpServer;
}
