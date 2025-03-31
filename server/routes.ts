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
          // Log the incoming message for debugging
          console.log('Received community message:', {
            communityId: message.communityId,
            userId: message.userId,
            messageContent: message.message && message.message.length > 50 
              ? message.message.substring(0, 50) + '...' 
              : message.message
          });
          
          try {
            // Validate that the user belongs to the community
            const user = await storage.getUser(message.userId);
            if (!user) {
              throw new Error('User not found');
            }
            
            if (user.communityId !== message.communityId) {
              throw new Error('User does not belong to this community');
            }
            
            // Create and save the community chat message
            const chat = await storage.createCommunityChat({
              communityId: message.communityId,
              userId: message.userId,
              message: message.message
            });
            
            console.log('Community chat message saved:', chat.id);

            // Send confirmation to the sender first
            ws.send(JSON.stringify({
              type: 'COMMUNITY_CHAT_CONFIRMED',
              chat
            }));
            
            // Broadcast the message to all clients
            wss.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                  type: 'COMMUNITY_CHAT',
                  chat,
                  communityName: message.communityName
                }));
              }
            });
          } catch (error) {
            console.error('Error processing community message:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to process community message';
            ws.send(JSON.stringify({
              type: 'ERROR',
              message: errorMessage
            }));
          }
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
        const errorMessage = err instanceof Error ? err.message : 'Failed to process message';
        ws.send(JSON.stringify({
          type: 'ERROR',
          message: errorMessage
        }));
      }
    });
  });

  // Community routes
  app.get("/api/communities", async (req, res) => {
    const communities = await storage.getCommunities();
    res.json(communities);
  });
  
  app.get("/api/communities/:id", async (req, res) => {
    const communityId = parseInt(req.params.id);
    const community = await storage.getCommunity(communityId);
    
    if (!community) {
      return res.status(404).json({ message: "Community not found" });
    }
    
    res.json(community);
  });
  
  app.get("/api/communities/:id/members", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const communityId = parseInt(req.params.id);
    const members = await storage.getCommunityMembers(communityId);
    
    res.json(members);
  });
  
  app.patch("/api/communities/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const communityId = parseInt(req.params.id);
    const community = await storage.getCommunity(communityId);
    
    if (!community) {
      return res.status(404).json({ message: "Community not found" });
    }
    
    // Only the community creator can update the community
    if (community.createdBy !== req.user!.id) {
      return res.status(403).json({ message: "Only community admins can update the community" });
    }
    
    // Update community visibility
    if (req.body.isPublic !== undefined) {
      community.isPublic = req.body.isPublic;
      await storage.updateCommunity(communityId, { isPublic: req.body.isPublic });
    }
    
    res.json(community);
  });
  
  app.post("/api/communities/:id/remove-member", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const communityId = parseInt(req.params.id);
    const userId = parseInt(req.body.userId);
    
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }
    
    const community = await storage.getCommunity(communityId);
    
    if (!community) {
      return res.status(404).json({ message: "Community not found" });
    }
    
    // Only the community creator can remove members
    if (community.createdBy !== req.user!.id) {
      return res.status(403).json({ message: "Only community admins can remove members" });
    }
    
    // Can't remove community creator
    if (userId === community.createdBy) {
      return res.status(400).json({ message: "Cannot remove the community admin" });
    }
    
    // Get the user to make sure they're in this community
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    if (user.communityId !== communityId) {
      return res.status(400).json({ message: "User is not a member of this community" });
    }
    
    // Update user to remove community
    await storage.updateUser(userId, { communityId: null });
    
    // Add message to community chat
    const leaveChat = await storage.createCommunityChat({
      communityId,
      userId: req.user!.id,
      message: `${user.username} has been removed from the community by admin.`
    });

    // Broadcast the leave message
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'COMMUNITY_CHAT',
          chat: leaveChat,
          communityName: community.name
        }));
      }
    });
    
    res.json({ message: "Member removed successfully" });
  });
  
  app.post("/api/communities/:id/leave", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const communityId = parseInt(req.params.id);
    const community = await storage.getCommunity(communityId);
    
    if (!community) {
      return res.status(404).json({ message: "Community not found" });
    }
    
    // Check if user is a member of this community
    if (req.user!.communityId !== communityId) {
      return res.status(400).json({ message: "You are not a member of this community" });
    }
    
    // If community creator is leaving, we might need special handling
    if (community.createdBy === req.user!.id) {
      // For now, we'll just let them leave
      // In a real app, you might want to transfer ownership or delete the community
    }
    
    // Update user to leave community
    await storage.updateUser(req.user!.id, { communityId: null });
    
    // If this wasn't the creator, add a leave message
    if (community.createdBy !== req.user!.id) {
      const leaveChat = await storage.createCommunityChat({
        communityId,
        userId: req.user!.id,
        message: `${req.user!.username} has left the community.`
      });
  
      // Broadcast the leave message
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'COMMUNITY_CHAT',
            chat: leaveChat,
            communityName: community.name
          }));
        }
      });
    }
    
    res.json({ message: "Left community successfully" });
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

    // Check if the community is the creator's community or a public community
    const isCreator = community.createdBy === req.user!.id;

    if (!community.isPublic && !isCreator) {
      // For private communities, create a join request instead of directly joining
      const joinRequest = await storage.createJoinRequest({
        userId: req.user!.id,
        communityId: community.id
      });

      // Alert the community creator about the join request
      const creator = await storage.getUser(community.createdBy);
      if (creator) {
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'JOIN_REQUEST',
              communityId: community.id,
              communityName: community.name,
              requesterId: req.user!.id,
              requesterUsername: req.user!.username
            }));
          }
        });
      }

      return res.json({ 
        message: "Join request submitted. Waiting for approval.",
        pendingApproval: true
      });
    }

    // For public communities or the community creator, directly join
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

  // Get community join requests
  app.get("/api/communities/:id/join-requests", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const communityId = parseInt(req.params.id);
    const community = await storage.getCommunity(communityId);
    
    if (!community) {
      return res.status(404).json({ message: "Community not found" });
    }
    
    // Only the community creator can view join requests
    if (community.createdBy !== req.user!.id) {
      return res.status(403).json({ message: "Only community admins can view join requests" });
    }
    
    const requests = await storage.getJoinRequests(communityId);
    res.json(requests);
  });
  
  // Accept a join request
  app.post("/api/communities/:communityId/join-requests/:requestId/accept", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const communityId = parseInt(req.params.communityId);
    const requestId = parseInt(req.params.requestId);
    
    const community = await storage.getCommunity(communityId);
    if (!community) {
      return res.status(404).json({ message: "Community not found" });
    }
    
    // Only the community creator can accept join requests
    if (community.createdBy !== req.user!.id) {
      return res.status(403).json({ message: "Only community admins can accept join requests" });
    }
    
    const requests = await storage.getJoinRequests(communityId);
    const request = requests.find(r => r.id === requestId);
    
    if (!request) {
      return res.status(404).json({ message: "Join request not found" });
    }
    
    // Update request status
    await storage.updateJoinRequest(requestId, "accepted");
    
    // Update user's community
    await storage.updateUser(request.userId, { communityId });
    
    // Get the user who requested to join
    const joiningUser = await storage.getUser(request.userId);
    
    if (joiningUser) {
      // Add welcome message to community chat
      const joinChat = await storage.createCommunityChat({
        communityId,
        userId: joiningUser.id,
        message: `${joiningUser.username} has joined the community!`
      });
      
      // Broadcast the join message
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'COMMUNITY_CHAT',
            chat: joinChat,
            communityName: community.name
          }));
          
          // Also notify the user that their request was accepted
          client.send(JSON.stringify({
            type: 'JOIN_REQUEST_ACCEPTED',
            communityId: community.id,
            communityName: community.name,
            userId: joiningUser.id
          }));
        }
      });
    }
    
    res.json({ message: "Join request accepted" });
  });
  
  // Decline a join request
  app.post("/api/communities/:communityId/join-requests/:requestId/decline", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const communityId = parseInt(req.params.communityId);
    const requestId = parseInt(req.params.requestId);
    
    const community = await storage.getCommunity(communityId);
    if (!community) {
      return res.status(404).json({ message: "Community not found" });
    }
    
    // Only the community creator can decline join requests
    if (community.createdBy !== req.user!.id) {
      return res.status(403).json({ message: "Only community admins can decline join requests" });
    }
    
    const requests = await storage.getJoinRequests(communityId);
    const request = requests.find(r => r.id === requestId);
    
    if (!request) {
      return res.status(404).json({ message: "Join request not found" });
    }
    
    // Update request status
    await storage.updateJoinRequest(requestId, "declined");
    
    // Notify the user that their request was declined
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'JOIN_REQUEST_DECLINED',
          communityId: community.id,
          communityName: community.name,
          userId: request.userId
        }));
      }
    });
    
    res.json({ message: "Join request declined" });
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

  // Legacy account verification endpoint is already implemented in auth.ts

  // Development/Admin endpoint to reset all data
  app.post("/api/reset-data", async (req, res) => {
    try {
      // First handle database reset if a database is being used
      try {
        const db = require("../db");
        console.log("Resetting database tables...");
        
        // Truncate all user-related tables
        await db.pool.query("TRUNCATE TABLE users CASCADE;");
        await db.pool.query("TRUNCATE TABLE session CASCADE;");
        
        // Reset borrow information in books
        await db.pool.query("UPDATE books SET borrowed = false, borrower_id = NULL, borrow_deadline = NULL;");
        
        // Truncate borrow requests
        await db.pool.query("TRUNCATE TABLE \"borrowRequests\" CASCADE;");
        
        // Truncate community join requests
        await db.pool.query("TRUNCATE TABLE community_join_requests CASCADE;");
        
        // Community membership reset
        await db.pool.query("UPDATE users SET community_id = NULL;");
        
        console.log("Database tables reset successfully");
      } catch (dbError) {
        console.error("Database reset error or using in-memory storage only:", dbError);
      }
      
      // Now reset the in-memory storage
      console.log("Resetting in-memory storage...");
      storage.resetAllData();
      
      // Destroy all sessions
      if (req.session) {
        req.session.destroy((err) => {
          if (err) {
            console.error("Error destroying session:", err);
          }
        });
      }
      
      res.status(200).json({ success: true, message: "All data has been reset" });
    } catch (error) {
      console.error("Error resetting data:", error);
      res.status(500).json({ success: false, message: "Error resetting data" });
    }
  });

  return httpServer;
}