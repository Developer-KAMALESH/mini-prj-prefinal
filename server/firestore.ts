import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';
import { 
  type User, 
  type InsertUser,
  type Group,
  type InsertGroup,
  type GroupMember,
  type InsertGroupMember,
  type Message,
  type InsertMessage,
  type Task,
  type InsertTask,
  type TaskSubmission,
  type InsertTaskSubmission
} from "@shared/schema";
import { IStorage } from './storage';

// Check if a service account file exists, otherwise use environment variables
let app;
try {
  // Try to use a service account file if it exists
  const serviceAccountPath = path.join(process.cwd(), 'service-account.json');
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    app = initializeApp({
      credential: cert(serviceAccount)
    });
  } else {
    // Otherwise, use environment variables
    app = initializeApp({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID
    });
  }
} catch (error) {
  console.error('Error initializing Firebase Admin:', error);
  throw error;
}

// Initialize Firestore
const firestore = getFirestore(app);

// Firestore implementation of the storage interface
export class FirestoreStorage implements IStorage {
  private usersCollection = firestore.collection('users');
  private groupsCollection = firestore.collection('groups');
  private groupMembersCollection = firestore.collection('group_members');
  private messagesCollection = firestore.collection('messages');
  private tasksCollection = firestore.collection('tasks');
  private taskSubmissionsCollection = firestore.collection('task_submissions');

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const snapshot = await this.usersCollection.where('id', '==', id).get();
    if (snapshot.empty) return undefined;
    return snapshot.docs[0].data() as User;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const snapshot = await this.usersCollection.where('username', '==', username).get();
    if (snapshot.empty) return undefined;
    return snapshot.docs[0].data() as User;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const snapshot = await this.usersCollection.where('email', '==', email).get();
    if (snapshot.empty) return undefined;
    return snapshot.docs[0].data() as User;
  }

  async createUser(userData: InsertUser): Promise<User> {
    // Get next ID
    const counterDoc = await firestore.collection('counters').doc('users').get();
    let nextId = 1;
    
    if (counterDoc.exists) {
      nextId = counterDoc.data()?.value + 1;
      await counterDoc.ref.update({ value: nextId });
    } else {
      await firestore.collection('counters').doc('users').set({ value: nextId });
    }
    
    const user: User = { 
      ...userData, 
      id: nextId,
      avatar: userData.avatar || null 
    };
    await this.usersCollection.doc(nextId.toString()).set(user);
    return user;
  }

  // Group methods
  async getGroup(id: number): Promise<Group | undefined> {
    const doc = await this.groupsCollection.doc(id.toString()).get();
    if (!doc.exists) return undefined;
    return doc.data() as Group;
  }

  async getUserGroups(userId: number): Promise<(Group & { isAdmin: boolean })[]> {
    const memberships = await this.groupMembersCollection
      .where('userId', '==', userId)
      .get();

    if (memberships.empty) return [];

    const groupPromises = memberships.docs.map(async doc => {
      const memberData = doc.data() as GroupMember;
      const groupDoc = await this.groupsCollection.doc(memberData.groupId.toString()).get();
      if (!groupDoc.exists) return null;
      return {
        ...(groupDoc.data() as Group),
        isAdmin: memberData.isAdmin
      };
    });

    const groups = await Promise.all(groupPromises);
    return groups.filter(group => group !== null) as (Group & { isAdmin: boolean })[];
  }

  async createGroup(groupData: InsertGroup, creatorId: number): Promise<Group> {
    // Get next ID
    const counterDoc = await firestore.collection('counters').doc('groups').get();
    let nextId = 1;
    
    if (counterDoc.exists) {
      nextId = counterDoc.data()?.value + 1;
      await counterDoc.ref.update({ value: nextId });
    } else {
      await firestore.collection('counters').doc('groups').set({ value: nextId });
    }
    
    const now = new Date();
    const group: Group = { 
      ...groupData, 
      id: nextId, 
      createdAt: now,
      description: groupData.description || null
    };
    
    await this.groupsCollection.doc(nextId.toString()).set(group);
    
    // Add creator as a member and admin
    await this.addUserToGroup({
      userId: creatorId,
      groupId: nextId,
      isAdmin: true,
    });
    
    return group;
  }

  // Group member methods
  async addUserToGroup(data: InsertGroupMember): Promise<GroupMember> {
    // Get next ID
    const counterDoc = await firestore.collection('counters').doc('group_members').get();
    let nextId = 1;
    
    if (counterDoc.exists) {
      nextId = counterDoc.data()?.value + 1;
      await counterDoc.ref.update({ value: nextId });
    } else {
      await firestore.collection('counters').doc('group_members').set({ value: nextId });
    }
    
    const now = new Date();
    const membership: GroupMember = {
      ...data,
      id: nextId,
      joinedAt: now,
      isAdmin: data.isAdmin === undefined ? false : data.isAdmin,
    };
    
    await this.groupMembersCollection.doc(nextId.toString()).set(membership);
    return membership;
  }

  async removeUserFromGroup(userId: number, groupId: number): Promise<boolean> {
    const snapshot = await this.groupMembersCollection
      .where('userId', '==', userId)
      .where('groupId', '==', groupId)
      .get();
    
    if (snapshot.empty) return false;
    
    const batch = firestore.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    return true;
  }

  async getGroupMembers(groupId: number): Promise<(GroupMember & { user: User })[]> {
    const memberships = await this.groupMembersCollection
      .where('groupId', '==', groupId)
      .get();
    
    if (memberships.empty) return [];
    
    const memberPromises = memberships.docs.map(async doc => {
      const memberData = doc.data() as GroupMember;
      const userDoc = await this.usersCollection.doc(memberData.userId.toString()).get();
      
      if (!userDoc.exists) return null;
      
      return {
        ...memberData,
        user: userDoc.data() as User
      };
    });
    
    const members = await Promise.all(memberPromises);
    return members.filter(member => member !== null) as (GroupMember & { user: User })[];
  }

  async isGroupAdmin(userId: number, groupId: number): Promise<boolean> {
    const snapshot = await this.groupMembersCollection
      .where('userId', '==', userId)
      .where('groupId', '==', groupId)
      .where('isAdmin', '==', true)
      .get();
    
    return !snapshot.empty;
  }

  // Message methods
  async getMessages(groupId: number, limit?: number): Promise<(Message & { user: User })[]> {
    let query = this.messagesCollection
      .where('groupId', '==', groupId)
      .orderBy('sentAt', 'desc');
    
    if (limit) {
      query = query.limit(limit);
    }
    
    const messages = await query.get();
    
    if (messages.empty) return [];
    
    const messagePromises = messages.docs.map(async doc => {
      const messageData = doc.data() as Message;
      const userDoc = await this.usersCollection.doc(messageData.userId.toString()).get();
      
      if (!userDoc.exists) return null;
      
      return {
        ...messageData,
        user: userDoc.data() as User
      };
    });
    
    const populatedMessages = await Promise.all(messagePromises);
    return populatedMessages.filter(message => message !== null) as (Message & { user: User })[];
  }

  async createMessage(messageData: InsertMessage): Promise<Message> {
    // Get next ID
    const counterDoc = await firestore.collection('counters').doc('messages').get();
    let nextId = 1;
    
    if (counterDoc.exists) {
      nextId = counterDoc.data()?.value + 1;
      await counterDoc.ref.update({ value: nextId });
    } else {
      await firestore.collection('counters').doc('messages').set({ value: nextId });
    }
    
    const now = new Date();
    const message: Message = {
      ...messageData,
      id: nextId,
      sentAt: now,
    };
    
    await this.messagesCollection.doc(nextId.toString()).set(message);
    return message;
  }

  // Task methods
  async getTasks(groupId: number): Promise<Task[]> {
    const snapshot = await this.tasksCollection
      .where('groupId', '==', groupId)
      .orderBy('createdAt', 'desc')
      .get();
    
    if (snapshot.empty) return [];
    
    return snapshot.docs.map(doc => doc.data() as Task);
  }

  async getTask(id: number): Promise<Task | undefined> {
    const doc = await this.tasksCollection.doc(id.toString()).get();
    if (!doc.exists) return undefined;
    return doc.data() as Task;
  }

  async createTask(taskData: InsertTask): Promise<Task> {
    // Get next ID
    const counterDoc = await firestore.collection('counters').doc('tasks').get();
    let nextId = 1;
    
    if (counterDoc.exists) {
      nextId = counterDoc.data()?.value + 1;
      await counterDoc.ref.update({ value: nextId });
    } else {
      await firestore.collection('counters').doc('tasks').set({ value: nextId });
    }
    
    const now = new Date();
    const task: Task = {
      ...taskData,
      id: nextId,
      createdAt: now,
      description: taskData.description || null,
      resourceLink: taskData.resourceLink || null,
      dueDate: taskData.dueDate || null
    };
    
    await this.tasksCollection.doc(nextId.toString()).set(task);
    return task;
  }

  // Task submission methods
  async getTaskSubmissions(taskId: number): Promise<(TaskSubmission & { user: User })[]> {
    const submissions = await this.taskSubmissionsCollection
      .where('taskId', '==', taskId)
      .orderBy('submittedAt', 'desc')
      .get();
    
    if (submissions.empty) return [];
    
    const submissionPromises = submissions.docs.map(async doc => {
      const submissionData = doc.data() as TaskSubmission;
      const userDoc = await this.usersCollection.doc(submissionData.userId.toString()).get();
      
      if (!userDoc.exists) return null;
      
      return {
        ...submissionData,
        user: userDoc.data() as User
      };
    });
    
    const populatedSubmissions = await Promise.all(submissionPromises);
    return populatedSubmissions.filter(submission => submission !== null) as (TaskSubmission & { user: User })[];
  }

  async getUserSubmissions(userId: number): Promise<(TaskSubmission & { task: Task })[]> {
    const submissions = await this.taskSubmissionsCollection
      .where('userId', '==', userId)
      .orderBy('submittedAt', 'desc')
      .get();
    
    if (submissions.empty) return [];
    
    const submissionPromises = submissions.docs.map(async doc => {
      const submissionData = doc.data() as TaskSubmission;
      const taskDoc = await this.tasksCollection.doc(submissionData.taskId.toString()).get();
      
      if (!taskDoc.exists) return null;
      
      return {
        ...submissionData,
        task: taskDoc.data() as Task
      };
    });
    
    const populatedSubmissions = await Promise.all(submissionPromises);
    return populatedSubmissions.filter(submission => submission !== null) as (TaskSubmission & { task: Task })[];
  }

  async submitTask(submissionData: InsertTaskSubmission): Promise<TaskSubmission> {
    // Get next ID
    const counterDoc = await firestore.collection('counters').doc('task_submissions').get();
    let nextId = 1;
    
    if (counterDoc.exists) {
      nextId = counterDoc.data()?.value + 1;
      await counterDoc.ref.update({ value: nextId });
    } else {
      await firestore.collection('counters').doc('task_submissions').set({ value: nextId });
    }
    
    const now = new Date();
    const submission: TaskSubmission = {
      ...submissionData,
      id: nextId,
      submittedAt: now,
      submissionLink: submissionData.submissionLink || null,
      score: submissionData.score || null
    };
    
    await this.taskSubmissionsCollection.doc(nextId.toString()).set(submission);
    return submission;
  }

  // Leaderboard methods
  async getLeaderboard(groupId: number): Promise<{ user: User; score: number }[]> {
    // Get all group members
    const members = await this.getGroupMembers(groupId);
    const memberIds = members.map(member => member.userId);
    
    // Get all tasks for the group
    const tasksSnapshot = await this.tasksCollection
      .where('groupId', '==', groupId)
      .get();
    
    if (tasksSnapshot.empty) {
      // No tasks yet, return members with 0 scores
      return members.map(member => ({
        user: member.user,
        score: 0
      }));
    }
    
    const taskIds = tasksSnapshot.docs.map(doc => (doc.data() as Task).id);
    
    // Calculate scores for each member
    const userScores: { [userId: number]: number } = {};
    for (const userId of memberIds) {
      userScores[userId] = 0;
      
      // Find all successful submissions by this user for tasks in this group
      const submissions = await this.taskSubmissionsCollection
        .where('userId', '==', userId)
        .where('status', '==', 'completed')
        .get();
      
      if (!submissions.empty) {
        for (const doc of submissions.docs) {
          const submission = doc.data() as TaskSubmission;
          if (taskIds.includes(submission.taskId)) {
            userScores[userId] += submission.score || 1; // Default to 1 point if no score specified
          }
        }
      }
    }
    
    // Create and sort leaderboard
    const leaderboard = members.map(member => ({
      user: member.user,
      score: userScores[member.userId] || 0
    })).sort((a, b) => b.score - a.score);
    
    return leaderboard;
  }
}

// Create and export a Firestore storage instance
export const firestoreStorage = new FirestoreStorage();