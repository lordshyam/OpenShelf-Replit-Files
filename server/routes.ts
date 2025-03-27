import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertBookSchema, insertCommunitySchema, userPreferencesSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  const httpServer = createServer(app);
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws',
    // Allow all origins without verification for now
    verifyClient: () => {
      return true;
    }
  });

  // WebSocket connection handling
  wss.on('connection', (ws, req) => {
    console.log('New WebSocket connection established');

    // Send initial connection confirmation
    ws.send(JSON.stringify({
      type: 'CONNECTION_STATUS',
      status: 'connected'
    }));

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === 'COMMUNITY_MESSAGE') {
          // Create and save the community chat message
          const chat = await storage.createCommunityChat({
            communityId: message.communityId,
            userId: message.userId,
            message: message.message
          });

          // Broadcast to all clients except the sender
          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'COMMUNITY_CHAT',
                chat,
                communityName: message.communityName
              }));
            }
          });

          // Send confirmation back to sender
          ws.send(JSON.stringify({
            type: 'COMMUNITY_CHAT_CONFIRMED',
            chat
          }));
        } else {
          const chat = await storage.createChat(message);

          // Broadcast to all clients except sender for private messages
          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'CHAT_MESSAGE',
                chat,
                bookTitle: message.bookTitle || "Chat message"
              }));
            }
          });

          // Send confirmation to sender
          ws.send(JSON.stringify({
            type: 'CHAT_MESSAGE_CONFIRMED',
            chat
          }));
        }
      } catch (err) {
        console.error('Error processing message:', err);
        ws.send(JSON.stringify({
          type: 'ERROR',
          message: 'Failed to process message'
        }));
      }
    });
  });

  // Community routes
  app.get("/api/communities", async (req, res) => {
    const communities = await storage.getCommunities();
    res.json(communities);
  });

  app.post("/api/communities", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Please login to create a community" });
    }

    const result = insertCommunitySchema.safeParse({ ...req.body, createdBy: req.user!.id });
    if (!result.success) {
      return res.status(400).json(result.error);
    }

    const community = await storage.createCommunity(result.data);

    // Create initial community chat
    const welcomeChat = await storage.createCommunityChat({
      communityId: community.id,
      userId: req.user!.id,
      message: `Welcome to ${community.name}! This is your community's group chat.`
    });

    // Broadcast the welcome message
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'COMMUNITY_CHAT',
          chat: welcomeChat,
          communityName: community.name
        }));
      }
    });

    res.status(201).json(community);
  });

  app.post("/api/communities/:id/join", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Please login to join a community" });
    }

    const communityId = parseInt(req.params.id);
    const community = await storage.getCommunity(communityId);

    if (!community) {
      return res.status(404).json({ message: "Community not found" });
    }

    // Update user's community
    await storage.updateUser(req.user!.id, { communityId });

    // Add welcome message to community chat
    const joinChat = await storage.createCommunityChat({
      communityId,
      userId: req.user!.id,
      message: `${req.user!.username} has joined the community!`
    });

    // Broadcast the join message
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'COMMUNITY_CHAT',
          chat: joinChat,
          communityName: community.name
        }));
      }
    });

    return res.json({ message: "Joined community successfully" });
  });

  // Get community chats endpoint
  app.get("/api/community-chats/:communityId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const communityId = parseInt(req.params.communityId);
    const chats = await storage.getCommunityChats(communityId);
    res.json(chats);
  });

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
    // Check authentication first
    if (!req.isAuthenticated()) {
      console.log('User not authenticated:', req.user);
      return res.status(401).json({ message: "Please login to list books" });
    }

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

    // Get user to check community membership
    const user = await storage.getUser(req.user!.id);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    if (!user.communityId) {
      return res.status(400).json({ message: "Please join a community before adding books" });
    }
    
    const book = await storage.createBook({
      ...result.data,
      ownerId: req.user!.id,
      communityId: user.communityId,
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


  return httpServer;
}