import { useState, useRef, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { z } from "zod";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { ChatMessage } from "@/components/ui/chat-message";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, addDoc, orderBy, onSnapshot } from "firebase/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ListChecks } from "lucide-react";
import 'remixicon/fonts/remixicon.css';

export default function GroupChat() {
  const { groupId } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Use the current auth.currentUser directly
  const [user, setUser] = useState(auth.currentUser);
  
  // Keep track of the current Firebase user
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
    });
    return () => unsubscribe();
  }, []);
  
  // State for Firestore data
  const [isLoading, setIsLoading] = useState(true);
  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGroupAdmin, setIsGroupAdmin] = useState(false);
  
  // Fetch group data
  useEffect(() => {
    if (!groupId || !user) return;
    
    const fetchGroup = async () => {
      try {
        setIsLoading(true);
        const groupDoc = await getDoc(doc(db, 'groups', groupId));
        
        if (groupDoc.exists()) {
          const groupData = groupDoc.data();
          setGroup({
            id: groupDoc.id,
            ...groupData
          });
          
          // Check if the current user is the creator/admin of this group
          if (groupData.creatorId === user.uid) {
            setIsGroupAdmin(true);
          }
        } else {
          setError("Group not found");
        }
      } catch (err: any) {
        console.error("Error fetching group:", err);
        setError(err.message || "Failed to load group data");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchGroup();
  }, [groupId, user]);
  
  // Fetch group members
  useEffect(() => {
    if (!groupId || !user) return;
    
    const fetchMembers = async () => {
      try {
        const membersQuery = query(
          collection(db, 'group_members'),
          where('groupId', '==', groupId)
        );
        
        const membersSnapshot = await getDocs(membersQuery);
        const membersData: any[] = [];
        
        for (const memberDoc of membersSnapshot.docs) {
          const memberData = memberDoc.data();
          const userDocRef = doc(db, 'users', memberData.userId);
          const userDocSnap = await getDoc(userDocRef);
          
          if (userDocSnap.exists()) {
            membersData.push({
              id: memberDoc.id,
              ...memberData,
              user: {
                id: userDocSnap.id,
                ...userDocSnap.data()
              }
            });
          }
        }
        
        setMembers(membersData);
      } catch (err: any) {
        console.error("Error fetching members:", err);
      }
    };
    
    fetchMembers();
  }, [groupId, user]);
  
  // Subscribe to messages
  useEffect(() => {
    if (!groupId || !user) return;
    
    // Create a composite index in Firestore to enable this query
    // This handles the "failed-precondition" error
    try {
      // First, try to get messages without ordering to avoid composite index error
      const messagesRef = collection(db, 'messages');
      const messagesQuery = query(
        messagesRef,
        where('groupId', '==', groupId)
      );
      
      const unsubscribe = onSnapshot(messagesQuery, async (snapshot) => {
        try {
          // Process messages and sort them in JavaScript instead of Firestore query
          const messagesData: any[] = [];
          
          for (const messageDoc of snapshot.docs) {
            const messageData = messageDoc.data();
            // Try to get user information if possible
            try {
              const userDocRef = doc(db, 'users', messageData.userId);
              const userDocSnap = await getDoc(userDocRef);
              
              if (userDocSnap.exists()) {
                messagesData.push({
                  id: messageDoc.id,
                  ...messageData,
                  user: {
                    id: userDocSnap.id,
                    ...userDocSnap.data()
                  }
                });
              } else {
                // If user doesn't exist yet, use the current user's data
                messagesData.push({
                  id: messageDoc.id,
                  ...messageData,
                  user: {
                    id: user.uid,
                    name: user.displayName || user.email?.split('@')[0] || "User",
                    email: user.email || "",
                    avatar: user.photoURL
                  }
                });
              }
            } catch (userErr) {
              console.error("Error fetching user for message:", userErr);
              // Still add the message with minimal user info
              messagesData.push({
                id: messageDoc.id,
                ...messageData,
                user: {
                  id: messageData.userId,
                  name: "Unknown User",
                  email: ""
                }
              });
            }
          }
          
          // Sort messages by sentAt
          messagesData.sort((a, b) => {
            return new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime();
          });
          
          setMessages(messagesData);
        } catch (err: any) {
          console.error("Error processing messages:", err);
        }
      }, (err) => {
        console.error("Error subscribing to messages:", err);
        setError("Failed to load messages");
      });
      
      return () => unsubscribe();
    } catch (err) {
      console.error("Failed to set up messages subscription:", err);
      setError("Failed to subscribe to messages");
    }
  }, [groupId, user]);
  
  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);
  
  // State for task creation
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    type: "general",
    resourceLink: ""
  });
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  
  // Handle task form input changes
  const handleTaskFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setTaskForm(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handle task type selection
  const handleTaskTypeChange = (value: string) => {
    setTaskForm(prev => ({
      ...prev,
      type: value
    }));
  };
  
  // Handle task creation
  const handleCreateTask = async () => {
    if (!user || !groupId || isCreatingTask) return;
    
    try {
      setIsCreatingTask(true);
      
      // Validate task form
      if (!taskForm.title.trim()) {
        toast({
          title: "Error",
          description: "Task title is required",
          variant: "destructive",
        });
        return;
      }
      
      // Create task in Firestore
      const taskData = {
        title: taskForm.title,
        description: taskForm.description,
        type: taskForm.type,
        resourceLink: taskForm.resourceLink,
        creatorId: user.uid,
        groupId: groupId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      const taskRef = await addDoc(collection(db, 'tasks'), taskData);
      
      // Add a notification message to the chat
      await addDoc(collection(db, 'messages'), {
        content: `📋 New Task: ${taskForm.title}`,
        userId: user.uid,
        groupId: groupId,
        sentAt: new Date().toISOString(),
        isTaskNotification: true,
        taskId: taskRef.id
      });
      
      // Reset task form
      setTaskForm({
        title: "",
        description: "",
        type: "general",
        resourceLink: ""
      });
      
      toast({
        title: "Success",
        description: "Task created successfully",
      });
    } catch (err: any) {
      console.error("Error creating task:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to create task. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingTask(false);
    }
  };
  
  // Handle message sending
  const handleSendMessage = async () => {
    if (!message.trim() || sendingMessage || !user || !groupId) return;
    
    try {
      setSendingMessage(true);
      
      await addDoc(collection(db, 'messages'), {
        content: message,
        userId: user.uid,
        groupId: groupId,
        sentAt: new Date().toISOString()
      });
      
      setMessage("");
    } catch (err: any) {
      console.error("Error sending message:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSendingMessage(false);
    }
  };
  
  // Handle key press (send on Enter)
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  // Loading state
  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">StudyConnect</h1>
          <p className="mb-4">Please log in to access the chat</p>
          <Button onClick={() => navigate('/auth')}>
            Go to Login
          </Button>
        </div>
      </div>
    );
  }
  
  // Main chat UI
  return (
    <div className="min-h-screen bg-neutral-light">
      <div className="flex h-screen overflow-hidden">
        {/* Desktop Sidebar */}
        <Sidebar 
          userName={user.displayName || user.email?.split('@')[0] || "User"} 
          userEmail={user.email || ""} 
          userAvatar={user.photoURL || null} 
          activeItem="chat" 
        />

        {/* Chat Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Chat Header */}
          <header className="bg-white border-b border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <button 
                  className="md:hidden text-neutral-dark mr-3"
                  onClick={() => navigate("/dashboard")}
                >
                  <i className="ri-arrow-left-line text-2xl"></i>
                </button>
                {group ? (
                  <>
                    <div className="flex-shrink-0 bg-primary rounded-full w-10 h-10 flex items-center justify-center text-white">
                      <span className="font-semibold">{group.name.substring(0, 2).toUpperCase()}</span>
                    </div>
                    <div className="ml-3">
                      <p className="font-semibold">{group.name}</p>
                      <p className="text-xs text-gray-500">
                        {members.length} members • {members.filter(m => m.userId !== user.uid).length} others
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="ml-3">
                    <p className="font-semibold">Loading...</p>
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-3">
                {isGroupAdmin && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <button className="text-neutral-dark hover:text-primary flex items-center">
                        <ListChecks className="h-5 w-5 mr-1" />
                        <span className="text-sm hidden md:inline">Create Task</span>
                      </button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New Task</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 mt-2">
                        <div>
                          <Label htmlFor="task-title">Task Title</Label>
                          <Input 
                            id="task-title" 
                            name="title"
                            value={taskForm.title}
                            onChange={handleTaskFormChange}
                            placeholder="Enter task title"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="task-description">Description</Label>
                          <Textarea 
                            id="task-description" 
                            name="description"
                            value={taskForm.description}
                            onChange={handleTaskFormChange}
                            placeholder="Enter task description"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="task-type">Task Type</Label>
                          <Select 
                            onValueChange={handleTaskTypeChange}
                            defaultValue={taskForm.type}
                          >
                            <SelectTrigger id="task-type">
                              <SelectValue placeholder="Select task type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="general">General Task</SelectItem>
                              <SelectItem value="leetcode">LeetCode Problem</SelectItem>
                              <SelectItem value="form">Google Form</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label htmlFor="task-link">Resource Link (Optional)</Label>
                          <Input 
                            id="task-link" 
                            name="resourceLink"
                            value={taskForm.resourceLink}
                            onChange={handleTaskFormChange}
                            placeholder="https://" 
                          />
                        </div>
                        
                        <Button 
                          className="w-full"
                          onClick={handleCreateTask}
                          disabled={isCreatingTask}
                        >
                          {isCreatingTask ? "Creating..." : "Create Task"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
                <button className="text-neutral-dark hover:text-primary">
                  <i className="ri-search-line text-xl"></i>
                </button>
                <button className="text-neutral-dark hover:text-primary">
                  <i className="ri-more-2-fill text-xl"></i>
                </button>
              </div>
            </div>
          </header>

          {/* Chat Messages */}
          <div 
            className="flex-1 overflow-y-auto p-4 bg-neutral-light/50 scrollbar-hide"
            style={{ scrollbarWidth: 'none' }}
          >
            {isLoading ? (
              <div className="h-full flex items-center justify-center">
                Loading messages...
              </div>
            ) : error ? (
              <div className="h-full flex items-center justify-center text-red-500">
                Error: {error}
              </div>
            ) : messages.length > 0 ? (
              <div className="space-y-4">
                {/* Date Separator */}
                <div className="flex items-center justify-center">
                  <div className="bg-gray-200 px-3 py-1 rounded-full text-xs text-gray-500">Today</div>
                </div>
                
                {/* Messages */}
                {messages.map((msg) => (
                  <ChatMessage
                    key={msg.id}
                    content={msg.content}
                    time={msg.sentAt}
                    user={msg.user}
                    currentUserId={user.uid}
                    isTaskNotification={msg.isTaskNotification || false}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                No messages yet. Be the first to say hello!
              </div>
            )}
          </div>

          {/* Chat Input */}
          <div className="bg-white border-t border-gray-200 p-3">
            <div className="flex items-end">
              <button className="text-neutral-dark hover:text-primary p-2">
                <i className="ri-attachment-2 text-xl"></i>
              </button>
              <div className="flex-1 mx-2">
                <Textarea 
                  placeholder="Type a message..." 
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-primary focus:border-primary resize-none h-12"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyPress}
                />
              </div>
              <Button 
                className="bg-primary hover:bg-primary-dark text-white p-3 rounded-full h-12 w-12 flex items-center justify-center"
                onClick={handleSendMessage}
                disabled={!message.trim() || sendingMessage}
                aria-label="Send message"
              >
                <i className="ri-send-plane-fill"></i>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <MobileNav activeItem="chat" />
    </div>
  );
}
