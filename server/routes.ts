import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { 
  insertBookSchema, 
  insertCommunitySchema, 
  userPreferencesSchema,
  insertUserReportSchema,
  User
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Reset all data on server start for development/testing purposes
  storage.resetEverything();
  
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

            // Send confirmation to the sender
            ws.send(JSON.stringify({
              type: 'COMMUNITY_CHAT_CONFIRMED',
              chatId: chat.id,
              message: message.message
            }));
            
            // Broadcast the message to all clients except the sender
            wss.clients.forEach((client) => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
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

  // Get current user info
  app.get("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });

  // Update user location
  app.post("/api/user/location", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    // Validate request body
    const locationSchema = z.object({
      state: z.string().min(1, "State is required"),
      city: z.string().min(1, "City is required")
    });
    
    const result = locationSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Invalid location data", errors: result.error.format() });
    }
    
    // Update user location
    await storage.updateUser(req.user!.id, {
      state: result.data.state,
      city: result.data.city,
      locationVerified: true
    });
    
    // Update session user
    if (req.user) {
      req.user.state = result.data.state;
      req.user.city = result.data.city;
      req.user.locationVerified = true;
    }
    
    res.json({ message: "Location updated successfully" });
  });
  
  // Update user profile
  app.post("/api/user/profile", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    // Validate request body
    const profileSchema = z.object({
      username: z.string().min(3, "Username must be at least 3 characters").optional(),
      state: z.string().min(1, "State is required").optional(),
      city: z.string().min(1, "City is required").optional(),
    });
    
    const result = profileSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Invalid profile data", errors: result.error.format() });
    }
    
    const updates: Partial<User> = {};
    
    // Only include fields that were provided
    if (result.data.username) updates.username = result.data.username;
    if (result.data.state) {
      updates.state = result.data.state;
      updates.locationVerified = true;
    }
    if (result.data.city) {
      updates.city = result.data.city;
      updates.locationVerified = true;
    }
    
    // Check if username already exists (if changing username)
    if (updates.username) {
      const existingUser = await storage.getUserByUsername(updates.username);
      if (existingUser && existingUser.id !== req.user!.id) {
        return res.status(400).json({ message: "Username already taken" });
      }
    }
    
    // Update user
    await storage.updateUser(req.user!.id, updates);
    
    // Update session user
    if (req.user) {
      if (updates.username) req.user.username = updates.username;
      if (updates.state) req.user.state = updates.state;
      if (updates.city) req.user.city = updates.city;
      if (updates.locationVerified) req.user.locationVerified = updates.locationVerified;
    }
    
    res.json({ 
      message: "Profile updated successfully",
      user: req.user
    });
  });

  // Get all users (for chat and message display)
  app.get("/api/users", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const users = await storage.getUsers();
    res.json(users);
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
    let books = await storage.getBooks();
    let bookOwners: Map<number, User> = new Map();
    
    // If communityId is provided, filter by it
    if (req.query.communityId) {
      const communityId = parseInt(req.query.communityId as string);
      books = books.filter(book => book.communityId === communityId);
    }

    // Don't show books that are already borrowed
    if (req.query.availableOnly === "true") {
      books = books.filter(book => !book.borrowed);
    }
    
    // Don't show unlisted books (except to the owner)
    if (req.isAuthenticated() && req.user?.id) {
      // For authenticated users, only hide unlisted books that they don't own
      books = books.filter(book => !book.unlisted || book.ownerId === req.user!.id);
      
      // Apply location-based filtering (if user has a verified location)
      if (req.user.locationVerified && req.user.state && req.user.city) {
        // Get all book owners' data for location matching
        for (const book of books) {
          if (!bookOwners.has(book.ownerId)) {
            const owner = await storage.getUser(book.ownerId);
            if (owner) {
              bookOwners.set(book.ownerId, owner);
              
              // Add owner location info to the book for frontend display
              (book as any).ownerCity = owner.city;
              (book as any).ownerState = owner.state;
            }
          } else {
            // Use cached owner data
            const owner = bookOwners.get(book.ownerId);
            if (owner) {
              (book as any).ownerCity = owner.city;
              (book as any).ownerState = owner.state;
            }
          }
        }
        
        // Sort books by location proximity:
        // 1. Books in same city first
        // 2. Books in same state next
        // 3. All other books last
        books.sort((a, b) => {
          const ownerA = bookOwners.get(a.ownerId);
          const ownerB = bookOwners.get(b.ownerId);
          
          // If both owners have verified locations
          if (ownerA?.locationVerified && ownerB?.locationVerified) {
            // If a is in same city but b isn't
            if (ownerA.city === req.user!.city && ownerB.city !== req.user!.city) {
              return -1;
            }
            // If b is in same city but a isn't
            if (ownerB.city === req.user!.city && ownerA.city !== req.user!.city) {
              return 1;
            }
            // If both are not in same city, check state
            if (ownerA.city !== req.user!.city && ownerB.city !== req.user!.city) {
              // If a is in same state but b isn't
              if (ownerA.state === req.user!.state && ownerB.state !== req.user!.state) {
                return -1;
              }
              // If b is in same state but a isn't
              if (ownerB.state === req.user!.state && ownerA.state !== req.user!.state) {
                return 1;
              }
            }
          }
          
          // Default case: no sorting change
          return 0;
        });
      }
    } else {
      // For unauthenticated users, hide all unlisted books
      books = books.filter(book => !book.unlisted);
    }

    res.json(books);
  });

  app.post("/api/books", async (req, res) => {
    try {
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
      
      // Check for duplicates - consider only non-unlisted books
      const isDuplicate = existingBooks.some(book =>
        book.ownerId === req.user!.id &&
        !book.unlisted && // Make sure we only check active (non-unlisted) books
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

      // Get the latest user data to ensure we have the current credits
      const updatedUser = await storage.getUser(req.user!.id);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found after book creation" });
      }
      
      // We need to work with integers for database compatibility
      // Store credits as integers internally (1 = 0.5 credits in display)
      const creditsToAdd = 1; // This represents 0.5 credits to the user
      const newCreditBalance = updatedUser.credits + creditsToAdd;

      // Update user's credits
      await storage.updateUserCredits(updatedUser.id, newCreditBalance);

      // Update the session user info with new credit balance
      if (req.user) {
        req.user.credits = newCreditBalance;
      }

      // Broadcast credit update through WebSocket
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'CREDIT_UPDATE',
            userId: updatedUser.id,
            credits: newCreditBalance
          }));
        }
      });
      
      try {
        // Get community info
        const community = await storage.getCommunity(user.communityId!);
        
        if (community) {
          // Create a notification message in the community chat
          const bookInfoMessage = `${user.username} has listed a new book: "${book.title}" by ${book.author}. ${book.description ? `Description: ${book.description}` : ''} ${book.condition ? `Condition: ${book.condition}` : ''}`;
          
          const communityChat = await storage.createCommunityChat({
            communityId: user.communityId!,
            userId: 0, // System message (OpenShelf)
            message: bookInfoMessage
          });
          
          // Broadcast the community message about the new book
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'COMMUNITY_CHAT',
                chat: communityChat,
                communityName: community.name,
                book: book // Include the full book data
              }));
            }
          });
        }
      } catch (chatError) {
        // Log the error but don't let it prevent the response
        console.error("Error sending community notification:", chatError);
        // Still allow the book creation to succeed
      }

      res.status(201).json(book);
    } catch (error) {
      console.error("Error creating book:", error);
      res.status(500).json({ message: "An error occurred while creating the book" });
    }
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
    if (req.user!.credits < 1) return res.status(400).send("Insufficient credits. You need 1 credit to borrow a book.");
    
    // Check if user has any unreturned books
    const borrowedBooks = await storage.getBooksByBorrower(req.user!.id);
    const unreturned = borrowedBooks.filter(b => b.borrowed && !b.returned);
    
    if (unreturned.length > 0) {
      return res.status(400).json({ 
        message: "You have unreturned books. Please return them before borrowing new ones.",
        unreturnedBooks: unreturned
      });
    }

    // Get the requested return date from the request body (if provided)
    const requestedReturnDate = req.body.requestedReturnDate ? new Date(req.body.requestedReturnDate) : undefined;
    
    // Create a borrow request with the return date
    const request = await storage.createBorrowRequest({
      bookId,
      requesterId: req.user!.id,
      requestedReturnDate,
    });

    // Send a notification to the book owner about the borrow request
    // Get the requester's username for the notification
    const requester = await storage.getUser(req.user!.id);
    
    // Format return date information
    let returnDateInfo = "";
    if (requestedReturnDate) {
      const dateFormatter = new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      returnDateInfo = ` until ${dateFormatter.format(requestedReturnDate)}`;
    }
    
    // Send the notification to the book owner
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'BORROW_REQUEST_NOTIFICATION',
          bookId: book.id,
          bookTitle: book.title,
          requesterId: req.user!.id,
          requesterName: requester ? requester.username : `User #${req.user!.id}`,
          requestId: request.id,
          message: `${requester ? requester.username : 'Someone'} would like to borrow "${book.title}"${returnDateInfo}. Please review this request in "My Library" → "Borrow Requests".`
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

    // Get all pending requests for this book
    const allRequests = (await storage.getBorrowRequests(req.user!.id))
      .filter(r => r.bookId === book.id && r.status === "pending");
    
    // Update the accepted request status
    await storage.updateBorrowRequest(requestId, "accepted");

    // Update the book status
    const twoWeeksFromNow = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 2 weeks
    await storage.updateBook(book.id, {
      borrowed: true,
      borrowerId: request.requesterId,
      borrowDeadline: request.requestedReturnDate || twoWeeksFromNow,
    });

    // Deduct credits from borrower and broadcast update
    const borrower = await storage.getUser(request.requesterId);
    if (borrower) {
      // Deduct 0.5 credits (internal value: 1)
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

    // Create a private chat room and notify the accepted user
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
    
    // Handle other pending requests for this book (auto-decline)
    for (const otherRequest of allRequests) {
      // Skip the accepted request
      if (otherRequest.id === requestId) continue;
      
      // Update the request status
      await storage.updateBorrowRequest(otherRequest.id, "declined");
      
      // Send a message from OpenShelf (system) to the requester
      const systemMessage = await storage.createChat({
        senderId: 0, // Using 0 as system/OpenShelf ID
        receiverId: otherRequest.requesterId,
        message: `Your request to borrow "${book.title}" was automatically declined because the book was borrowed by someone else.`,
        bookId: book.id,
      });
      
      // Broadcast the system notification
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'CHAT_MESSAGE',
            chat: systemMessage,
            bookTitle: book.title,
            systemMessage: true
          }));
        }
      });
    }

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

    // Notify the borrower through chat - using OpenShelf system message
    const systemMessage = await storage.createChat({
      senderId: 0, // Using 0 as system/OpenShelf ID
      receiverId: request.requesterId,
      message: `Your request to borrow "${book.title}" was declined by the owner.`,
      bookId: book.id,
    });

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'CHAT_MESSAGE',
          chat: systemMessage,
          bookTitle: book.title,
          systemMessage: true
        }));
      }
    });

    res.sendStatus(200);
  });

  // Legacy account verification endpoint is already implemented in auth.ts

  // Endpoint for borrower to mark a book as returned (pending owner confirmation)
  app.post("/api/books/:id/return", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const bookId = parseInt(req.params.id);
    const book = await storage.getBooks().then(books =>
      books.find(b => b.id === bookId)
    );

    if (!book) return res.status(404).json({ message: "Book not found" });
    if (!book.borrowed) return res.status(400).json({ message: "Book is not borrowed" });
    if (book.borrowerId !== req.user!.id) return res.status(403).json({ message: "This is not your borrowed book" });

    const isReturned = req.body.returned === true;
    
    // Update the book's return status
    const updatedBook = await storage.updateBook(bookId, {
      returned: isReturned
    });

    // If marked as returned, notify the owner through chat
    if (isReturned) {
      const chat = await storage.createChat({
        senderId: req.user!.id,
        receiverId: book.ownerId,
        message: `I've marked "${book.title}" as returned.`,
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
    }

    res.json(updatedBook);
  });
  
  // Endpoint for owner to confirm return and complete the return process
  app.post("/api/books/:id/confirm-return", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const bookId = parseInt(req.params.id);
    const book = await storage.getBooks().then(books =>
      books.find(b => b.id === bookId)
    );

    if (!book) return res.status(404).json({ message: "Book not found" });
    if (!book.borrowed) return res.status(400).json({ message: "Book is not borrowed" });
    if (book.ownerId !== req.user!.id) return res.status(403).json({ message: "This is not your book" });

    // Get the borrower info for later use
    const borrower = await storage.getUser(book.borrowerId!);
    
    // Complete the return process and reset the borrow status
    const updatedBook = await storage.updateBook(bookId, {
      borrowed: false,
      borrowerId: undefined,
      borrowDeadline: undefined,
      returned: false // Reset returned flag
    });

    // Credit the borrower back for returning the book
    if (borrower) {
      // Return 0.5 credits (internal value: 1)
      const newCredits = borrower.credits + 1;
      await storage.updateUserCredits(borrower.id, newCredits);
      
      // Send credit update notification
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

    // Notify the borrower through chat
    const chat = await storage.createChat({
      senderId: req.user!.id,
      receiverId: book.borrowerId!,
      message: `I've confirmed that you returned "${book.title}". Thank you! Your 0.5 credit has been returned to your account.`,
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

    res.json(updatedBook);
  });
  
  // Endpoint for early return request
  app.post("/api/books/:id/return-early", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const bookId = parseInt(req.params.id);
    const book = await storage.getBooks().then(books =>
      books.find(b => b.id === bookId)
    );

    if (!book) return res.status(404).json({ message: "Book not found" });
    if (!book.borrowed) return res.status(400).json({ message: "Book is not borrowed" });
    if (book.borrowerId !== req.user!.id) return res.status(403).json({ message: "This is not your borrowed book" });

    // Mark the book as returned
    const updatedBook = await storage.updateBook(bookId, {
      returned: true
    });

    // Notify the owner through chat about early return
    const chat = await storage.createChat({
      senderId: req.user!.id,
      receiverId: book.ownerId,
      message: `I'd like to return "${book.title}" early. I've marked it as returned.`,
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

    res.json(updatedBook);
  });
  
  // Toggle a book's unlisted status
  app.post("/api/books/:id/toggle-visibility", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const bookId = parseInt(req.params.id);
    const book = await storage.getBooks().then(books =>
      books.find(b => b.id === bookId)
    );
    
    if (!book) return res.status(404).json({ message: "Book not found" });
    if (book.ownerId !== req.user!.id) return res.status(403).json({ message: "Not your book" });
    
    // If the book is borrowed, it cannot be unlisted
    if (book.borrowed && !book.unlisted) {
      return res.status(400).json({ 
        message: "Cannot unlist a book that is currently borrowed" 
      });
    }
    
    // Toggle the visibility
    const unlisted = !book.unlisted;
    const updatedBook = await storage.updateBook(bookId, { unlisted });
    
    // Update the user's credits based on unlisted status
    try {
      // Get latest user data to ensure we have current credits
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        console.error("User not found when toggling book visibility");
      } else {
        // If book is now unlisted, deduct credit (user hid the book)
        // If book is now visible again, add credit back (user relisted the book)
        // Using 1 as the credits delta (represents 0.5 credits to the user)
        const creditsDelta = unlisted ? -1 : 1;
        const newCreditBalance = user.credits + creditsDelta;
        
        // Update user's credits
        await storage.updateUserCredits(user.id, newCreditBalance);
        
        // Update session
        if (req.user) {
          req.user.credits = newCreditBalance;
        }
        
        // Broadcast credit update through WebSocket
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'CREDIT_UPDATE',
              userId: user.id,
              credits: newCreditBalance
            }));
          }
        });
        
        // Add a notification in community chat
        const action = unlisted ? "unlisted" : "relisted";
        const creditsAction = unlisted ? "lost" : "gained back";
        const communityChat = await storage.createCommunityChat({
          communityId: user.communityId!,
          userId: 0, // System message
          message: `${user.username} has ${action} their book "${book.title}" and ${creditsAction} 0.5 credits.`
        });
        
        // Get community for notification
        const community = await storage.getCommunity(user.communityId!);
        if (community) {
          // Broadcast the community message
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'COMMUNITY_CHAT',
                chat: communityChat,
                communityName: community.name
              }));
            }
          });
        }
      }
    } catch (error) {
      console.error("Error updating credits when toggling book visibility:", error);
      // We still return the updated book even if credit update fails
    }
    
    res.json(updatedBook);
  });

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

  // User reports
  app.get("/api/user-reports", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    // Regular users can only see their own reports
    // Admin would be able to see all (not implemented yet)
    const reports = await storage.getUserReportsByReporter(req.user!.id);
    res.json(reports);
  });

  app.post("/api/user-reports", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      // Make sure the current user is the reporter
      req.body.reporterId = req.user!.id;
      
      // Parse and validate the report data
      const reportData = insertUserReportSchema.parse(req.body);
      
      // Create the report
      const report = await storage.createUserReport(reportData);
      
      // Send notification to the reported user
      const systemMessage = await storage.createChat({
        senderId: 0, // System user ID
        receiverId: reportData.reportedUserId,
        message: `A user has reported an issue regarding ${reportData.reportType.replace(/_/g, ' ')}. Our moderation team will review the report.`,
      });
      
      // Notify admin (via WebSocket)
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'NEW_REPORT',
            report,
          }));
        }
      });
      
      res.status(201).json(report);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });

  // Update report status (for admins)
  app.patch("/api/user-reports/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    // In a real app, check if user is admin
    // if (!req.user!.isAdmin) return res.sendStatus(403);
    
    const id = parseInt(req.params.id);
    const { status } = req.body;
    
    if (!status || !['pending', 'reviewed', 'dismissed', 'actioned'].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    
    try {
      await storage.updateUserReportStatus(id, status);
      res.json({ success: true });
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  });

  // Automated reminder system for book returns
  // This would typically be run via a scheduler, but for demo purposes, we'll check on API calls
  app.get("/api/check-overdue-books", async (req, res) => {
    // Check for books with passed deadline
    const books = await storage.getBooks();
    const now = new Date();
    const overdueBooks = books.filter(book => 
      book.borrowed && 
      book.borrowDeadline && 
      new Date(book.borrowDeadline) < now && 
      !book.returned
    );
    
    // Process each overdue book
    for (const book of overdueBooks) {
      if (!book.borrowerId) continue;
      
      const owner = await storage.getUser(book.ownerId);
      const borrower = await storage.getUser(book.borrowerId);
      
      if (!owner || !borrower) continue;
      
      // Create reminder chat message
      await storage.createChat({
        senderId: 0, // System
        receiverId: book.borrowerId,
        message: `REMINDER: "${book.title}" is overdue for return. Please return it to ${owner.username} as soon as possible or contact them to make arrangements.`,
        bookId: book.id,
      });
      
      // Send email (mock - would be implemented in production)
      console.log(`OVERDUE BOOK REMINDER EMAIL to ${borrower.email} about "${book.title}"`);
      
      // Notify via WebSocket for real-time updates
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'BOOK_OVERDUE',
            book,
            overdueDays: Math.floor((now.getTime() - new Date(book.borrowDeadline!).getTime()) / (1000 * 60 * 60 * 24))
          }));
        }
      });
    }
    
    res.json({ 
      checked: books.length,
      overdue: overdueBooks.length,
      books: overdueBooks.map(b => ({ 
        id: b.id, 
        title: b.title, 
        borrowDeadline: b.borrowDeadline,
        daysOverdue: Math.floor((now.getTime() - new Date(b.borrowDeadline!).getTime()) / (1000 * 60 * 60 * 24))
      }))
    });
  });

  return httpServer;
}