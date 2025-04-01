import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { firestoreStorage } from "./firestore";
import { 
  insertUserSchema, 
  insertGroupSchema, 
  insertGroupMemberSchema,
  insertMessageSchema,
  insertTaskSchema,
  insertTaskSubmissionSchema
} from "@shared/schema";
import { z } from "zod";
import session from "express-session";
import MemoryStore from "memorystore";
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { typeDefs, resolvers } from './graphql';
import { auth as firebaseAuth } from 'firebase-admin';

// Configure session
const configureSession = (app: Express) => {
  const sessionStore = MemoryStore(session);
  
  app.use(session({
    secret: process.env.SESSION_SECRET || 'study-connect-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    },
    store: new sessionStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    })
  }));
};

// Auth middleware
const isAuthenticated = (req: Request, res: Response, next: Function) => {
  if (req.session.userId) {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Configure session
  configureSession(app);
  
  // Set up GraphQL server
  const apolloServer = new ApolloServer({
    typeDefs,
    resolvers,
  });
  
  await apolloServer.start();
  
  app.use('/api/graphql', expressMiddleware(apolloServer));
  
  // Auth routes
  app.post('/api/auth/register', async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if username or email already exists
      const existingUser = await firestoreStorage.getUserByUsername(userData.username) || 
                           await firestoreStorage.getUserByEmail(userData.email);
      
      if (existingUser) {
        return res.status(400).json({ message: "Username or email already exists" });
      }
      
      const user = await firestoreStorage.createUser(userData);
      
      // Set user session
      req.session.userId = user.id;
      
      // Return user without password
      const { password, ...userWithoutPassword } = user;
      return res.status(201).json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      
      const user = await firestoreStorage.getUserByEmail(email);
      
      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Set user session
      req.session.userId = user.id;
      
      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      return res.json(userWithoutPassword);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });
  
  app.get('/api/auth/me', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const user = await firestoreStorage.getUser(req.session.userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const { password, ...userWithoutPassword } = user;
    return res.json(userWithoutPassword);
  });
  
  // Group routes
  app.get('/api/groups', isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId as number;
      const groups = await firestoreStorage.getUserGroups(userId);
      return res.json(groups);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post('/api/groups', isAuthenticated, async (req, res) => {
    try {
      const groupData = insertGroupSchema.parse(req.body);
      const userId = req.session.userId as number;
      
      const group = await firestoreStorage.createGroup(groupData, userId);
      return res.status(201).json(group);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get('/api/groups/:id', isAuthenticated, async (req, res) => {
    try {
      const groupId = parseInt(req.params.id);
      const group = await firestoreStorage.getGroup(groupId);
      
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      
      return res.json(group);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post('/api/groups/:id/members', isAuthenticated, async (req, res) => {
    try {
      const groupId = parseInt(req.params.id);
      const userId = req.session.userId as number;
      
      // Verify group exists
      const group = await firestoreStorage.getGroup(groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      
      // Check if user is an admin
      const isAdmin = await firestoreStorage.isGroupAdmin(userId, groupId);
      if (!isAdmin) {
        return res.status(403).json({ message: "Only admins can add members" });
      }
      
      const memberData = insertGroupMemberSchema.parse({
        ...req.body,
        groupId
      });
      
      const member = await firestoreStorage.addUserToGroup(memberData);
      return res.status(201).json(member);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get('/api/groups/:id/members', isAuthenticated, async (req, res) => {
    try {
      const groupId = parseInt(req.params.id);
      
      // Verify group exists
      const group = await firestoreStorage.getGroup(groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      
      const members = await firestoreStorage.getGroupMembers(groupId);
      return res.json(members);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Message routes
  app.get('/api/groups/:id/messages', isAuthenticated, async (req, res) => {
    try {
      const groupId = parseInt(req.params.id);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      
      // Verify group exists
      const group = await firestoreStorage.getGroup(groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      
      const messages = await firestoreStorage.getMessages(groupId, limit);
      return res.json(messages);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post('/api/groups/:id/messages', isAuthenticated, async (req, res) => {
    try {
      const groupId = parseInt(req.params.id);
      const userId = req.session.userId as number;
      
      // Verify group exists
      const group = await firestoreStorage.getGroup(groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      
      const messageData = insertMessageSchema.parse({
        ...req.body,
        userId,
        groupId
      });
      
      const message = await firestoreStorage.createMessage(messageData);
      
      // Get user data to return with message
      const user = await firestoreStorage.getUser(userId);
      
      return res.status(201).json({
        ...message,
        user
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Task routes
  app.get('/api/groups/:id/tasks', isAuthenticated, async (req, res) => {
    try {
      const groupId = parseInt(req.params.id);
      
      // Verify group exists
      const group = await firestoreStorage.getGroup(groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      
      const tasks = await firestoreStorage.getTasks(groupId);
      return res.json(tasks);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post('/api/groups/:id/tasks', isAuthenticated, async (req, res) => {
    try {
      const groupId = parseInt(req.params.id);
      const userId = req.session.userId as number;
      
      // Verify group exists
      const group = await firestoreStorage.getGroup(groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      
      // Check if user is an admin
      const isAdmin = await firestoreStorage.isGroupAdmin(userId, groupId);
      if (!isAdmin) {
        return res.status(403).json({ message: "Only admins can create tasks" });
      }
      
      const taskData = insertTaskSchema.parse({
        ...req.body,
        creatorId: userId,
        groupId
      });
      
      const task = await firestoreStorage.createTask(taskData);
      return res.status(201).json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get('/api/tasks/:id/submissions', isAuthenticated, async (req, res) => {
    try {
      const taskId = parseInt(req.params.id);
      
      // Verify task exists
      const task = await firestoreStorage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      const submissions = await firestoreStorage.getTaskSubmissions(taskId);
      return res.json(submissions);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post('/api/tasks/:id/submit', isAuthenticated, async (req, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const userId = req.session.userId as number;
      
      // Verify task exists
      const task = await firestoreStorage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      const submissionData = insertTaskSubmissionSchema.parse({
        ...req.body,
        taskId,
        userId
      });
      
      const submission = await firestoreStorage.submitTask(submissionData);
      return res.status(201).json(submission);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Leaderboard route
  app.get('/api/groups/:id/leaderboard', isAuthenticated, async (req, res) => {
    try {
      const groupId = parseInt(req.params.id);
      
      // Verify group exists
      const group = await firestoreStorage.getGroup(groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      
      const leaderboard = await firestoreStorage.getLeaderboard(groupId);
      return res.json(leaderboard);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  const httpServer = createServer(app);
  
  return httpServer;
}
