import { 
  users, 
  groups, 
  groupMembers, 
  messages, 
  tasks, 
  taskSubmissions,
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

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Group methods
  getGroup(id: number): Promise<Group | undefined>;
  getUserGroups(userId: number): Promise<(Group & { isAdmin: boolean })[]>;
  createGroup(group: InsertGroup, creatorId: number): Promise<Group>;
  
  // Group member methods
  addUserToGroup(data: InsertGroupMember): Promise<GroupMember>;
  removeUserFromGroup(userId: number, groupId: number): Promise<boolean>;
  getGroupMembers(groupId: number): Promise<(GroupMember & { user: User })[]>;
  isGroupAdmin(userId: number, groupId: number): Promise<boolean>;
  
  // Message methods
  getMessages(groupId: number, limit?: number): Promise<(Message & { user: User })[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  
  // Task methods
  getTasks(groupId: number): Promise<Task[]>;
  getTask(id: number): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  
  // Task submission methods
  getTaskSubmissions(taskId: number): Promise<(TaskSubmission & { user: User })[]>;
  getUserSubmissions(userId: number): Promise<(TaskSubmission & { task: Task })[]>;
  submitTask(submission: InsertTaskSubmission): Promise<TaskSubmission>;
  
  // Leaderboard methods
  getLeaderboard(groupId: number): Promise<{ user: User; score: number }[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private groups: Map<number, Group>;
  private groupMembers: Map<number, GroupMember>;
  private messages: Map<number, Message>;
  private tasks: Map<number, Task>;
  private taskSubmissions: Map<number, TaskSubmission>;
  
  private userIdCounter: number;
  private groupIdCounter: number;
  private groupMemberIdCounter: number;
  private messageIdCounter: number;
  private taskIdCounter: number;
  private taskSubmissionIdCounter: number;
  
  constructor() {
    this.users = new Map();
    this.groups = new Map();
    this.groupMembers = new Map();
    this.messages = new Map();
    this.tasks = new Map();
    this.taskSubmissions = new Map();
    
    this.userIdCounter = 1;
    this.groupIdCounter = 1;
    this.groupMemberIdCounter = 1;
    this.messageIdCounter = 1;
    this.taskIdCounter = 1;
    this.taskSubmissionIdCounter = 1;
  }
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }
  
  async createUser(userData: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = { ...userData, id };
    this.users.set(id, user);
    return user;
  }
  
  // Group methods
  async getGroup(id: number): Promise<Group | undefined> {
    return this.groups.get(id);
  }
  
  async getUserGroups(userId: number): Promise<(Group & { isAdmin: boolean })[]> {
    // Find all group memberships for the user
    const memberships = Array.from(this.groupMembers.values()).filter(
      (membership) => membership.userId === userId
    );
    
    // Get the corresponding groups with admin status
    return memberships.map((membership) => {
      const group = this.groups.get(membership.groupId);
      return { 
        ...(group as Group), 
        isAdmin: membership.isAdmin 
      };
    });
  }
  
  async createGroup(groupData: InsertGroup, creatorId: number): Promise<Group> {
    const id = this.groupIdCounter++;
    const now = new Date();
    const group: Group = { 
      ...groupData, 
      id, 
      createdAt: now,
    };
    this.groups.set(id, group);
    
    // Add creator as a member and admin
    await this.addUserToGroup({
      userId: creatorId,
      groupId: id,
      isAdmin: true,
    });
    
    return group;
  }
  
  // Group member methods
  async addUserToGroup(data: InsertGroupMember): Promise<GroupMember> {
    const id = this.groupMemberIdCounter++;
    const now = new Date();
    const membership: GroupMember = {
      ...data,
      id,
      joinedAt: now,
    };
    this.groupMembers.set(id, membership);
    return membership;
  }
  
  async removeUserFromGroup(userId: number, groupId: number): Promise<boolean> {
    const membershipId = Array.from(this.groupMembers.entries()).find(
      ([_, membership]) => membership.userId === userId && membership.groupId === groupId
    )?.[0];
    
    if (membershipId) {
      return this.groupMembers.delete(membershipId);
    }
    return false;
  }
  
  async getGroupMembers(groupId: number): Promise<(GroupMember & { user: User })[]> {
    const memberships = Array.from(this.groupMembers.values()).filter(
      (membership) => membership.groupId === groupId
    );
    
    return memberships.map((membership) => {
      const user = this.users.get(membership.userId);
      return { 
        ...membership, 
        user: user as User 
      };
    });
  }
  
  async isGroupAdmin(userId: number, groupId: number): Promise<boolean> {
    const membership = Array.from(this.groupMembers.values()).find(
      (membership) => membership.userId === userId && membership.groupId === groupId
    );
    
    return !!membership?.isAdmin;
  }
  
  // Message methods
  async getMessages(groupId: number, limit?: number): Promise<(Message & { user: User })[]> {
    let groupMessages = Array.from(this.messages.values())
      .filter((message) => message.groupId === groupId)
      .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
    
    if (limit) {
      groupMessages = groupMessages.slice(0, limit);
    }
    
    return groupMessages.map((message) => {
      const user = this.users.get(message.userId);
      return { 
        ...message, 
        user: user as User 
      };
    });
  }
  
  async createMessage(messageData: InsertMessage): Promise<Message> {
    const id = this.messageIdCounter++;
    const now = new Date();
    const message: Message = {
      ...messageData,
      id,
      sentAt: now,
    };
    this.messages.set(id, message);
    return message;
  }
  
  // Task methods
  async getTasks(groupId: number): Promise<Task[]> {
    return Array.from(this.tasks.values())
      .filter((task) => task.groupId === groupId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  
  async getTask(id: number): Promise<Task | undefined> {
    return this.tasks.get(id);
  }
  
  async createTask(taskData: InsertTask): Promise<Task> {
    const id = this.taskIdCounter++;
    const now = new Date();
    const task: Task = {
      ...taskData,
      id,
      createdAt: now,
    };
    this.tasks.set(id, task);
    return task;
  }
  
  // Task submission methods
  async getTaskSubmissions(taskId: number): Promise<(TaskSubmission & { user: User })[]> {
    const submissions = Array.from(this.taskSubmissions.values())
      .filter((submission) => submission.taskId === taskId)
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    
    return submissions.map((submission) => {
      const user = this.users.get(submission.userId);
      return { 
        ...submission, 
        user: user as User 
      };
    });
  }
  
  async getUserSubmissions(userId: number): Promise<(TaskSubmission & { task: Task })[]> {
    const submissions = Array.from(this.taskSubmissions.values())
      .filter((submission) => submission.userId === userId)
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    
    return submissions.map((submission) => {
      const task = this.tasks.get(submission.taskId);
      return { 
        ...submission, 
        task: task as Task 
      };
    });
  }
  
  async submitTask(submissionData: InsertTaskSubmission): Promise<TaskSubmission> {
    const id = this.taskSubmissionIdCounter++;
    const now = new Date();
    const submission: TaskSubmission = {
      ...submissionData,
      id,
      submittedAt: now,
    };
    this.taskSubmissions.set(id, submission);
    return submission;
  }
  
  // Leaderboard methods
  async getLeaderboard(groupId: number): Promise<{ user: User; score: number }[]> {
    // Get all group members
    const members = await this.getGroupMembers(groupId);
    const memberIds = members.map(member => member.userId);
    
    // Get all tasks for the group
    const groupTasks = await this.getTasks(groupId);
    const taskIds = groupTasks.map(task => task.id);
    
    // Calculate scores for each member
    const userScores: { [userId: number]: number } = {};
    
    for (const userId of memberIds) {
      userScores[userId] = 0;
      
      // Find all successful submissions by this user for tasks in this group
      const submissions = Array.from(this.taskSubmissions.values()).filter(
        (submission) => 
          submission.userId === userId && 
          taskIds.includes(submission.taskId) &&
          submission.status === "completed"
      );
      
      // Sum up scores
      submissions.forEach(submission => {
        userScores[userId] += submission.score || 1; // Default to 1 point if no score specified
      });
    }
    
    // Create and sort leaderboard
    const leaderboard = members.map(member => ({
      user: member.user,
      score: userScores[member.userId] || 0
    })).sort((a, b) => b.score - a.score);
    
    return leaderboard;
  }
}

export const storage = new MemStorage();
