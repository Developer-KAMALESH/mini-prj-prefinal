import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { auth, db } from "@/lib/firebase";
import { 
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  addDoc
} from "firebase/firestore";

// Task creation schema
const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  type: z.enum(["general", "leetcode", "form"]),
  resourceLink: z.string().url().optional().or(z.literal("")),
});
type CreateTaskFormValues = z.infer<typeof createTaskSchema>;

// Task submission schema
const submitTaskSchema = z.object({
  submissionLink: z.string().url().optional().or(z.literal("")),
  comments: z.string().optional(),
});
type SubmitTaskFormValues = z.infer<typeof submitTaskSchema>;

export default function Tasks() {
  const [, navigate] = useLocation();
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const { toast } = useToast();
  
  // State
  const [user, setUser] = useState(auth.currentUser);
  const [groups, setGroups] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [submissions, setSubmissions] = useState<any[]>([]);
  
  // Keep track of the current Firebase user
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
    });
    return () => unsubscribe();
  }, []);
  
  // Fetch user groups
  useEffect(() => {
    if (!user) return;
    
    const fetchGroups = async () => {
      try {
        setIsLoadingGroups(true);
        setError(null);
        
        // Get groups where user is a member
        const membershipQuery = query(
          collection(db, 'group_members'),
          where('userId', '==', user.uid)
        );
        
        const membershipSnapshot = await getDocs(membershipQuery);
        const groupIds = membershipSnapshot.docs.map(doc => doc.data().groupId);
        
        // Get groups where user is the creator
        const creatorQuery = query(
          collection(db, 'groups'),
          where('creatorId', '==', user.uid)
        );
        
        const creatorSnapshot = await getDocs(creatorQuery);
        creatorSnapshot.docs.forEach(doc => {
          if (!groupIds.includes(doc.id)) {
            groupIds.push(doc.id);
          }
        });
        
        // Fetch all group data
        const groupsData: any[] = [];
        
        for (const groupId of groupIds) {
          const groupDoc = await getDoc(doc(db, 'groups', groupId));
          
          if (groupDoc.exists()) {
            const groupData = groupDoc.data();
            const isAdmin = groupData.creatorId === user.uid;
            
            if (!isAdmin) {
              // Check if user is admin via group members
              const memberQuery = query(
                collection(db, 'group_members'),
                where('groupId', '==', groupId),
                where('userId', '==', user.uid)
              );
              
              const memberSnapshot = await getDocs(memberQuery);
              
              if (!memberSnapshot.empty) {
                const memberData = memberSnapshot.docs[0].data();
                
                groupsData.push({
                  id: groupId,
                  ...groupData,
                  isAdmin: memberData.isAdmin
                });
              }
            } else {
              groupsData.push({
                id: groupId,
                ...groupData,
                isAdmin
              });
            }
          }
        }
        
        setGroups(groupsData);
      } catch (err: any) {
        console.error("Error fetching groups:", err);
        setError(err.message || "Failed to load groups");
      } finally {
        setIsLoadingGroups(false);
      }
    };
    
    fetchGroups();
  }, [user]);
  
  // Fetch tasks for selected group
  useEffect(() => {
    if (!selectedGroup || !user) return;
    
    const fetchTasks = async () => {
      try {
        setIsLoadingTasks(true);
        
        // Get tasks for the selected group
        const tasksQuery = query(
          collection(db, 'tasks'),
          where('groupId', '==', selectedGroup)
        );
        
        const tasksSnapshot = await getDocs(tasksQuery);
        const tasksData = tasksSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Sort tasks by creation date (newest first)
        tasksData.sort((a: any, b: any) => {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        
        setTasks(tasksData);
        
        // Get user submissions to mark tasks as completed
        const submissionsQuery = query(
          collection(db, 'task_submissions'),
          where('userId', '==', user.uid)
        );
        
        const submissionsSnapshot = await getDocs(submissionsQuery);
        const submissionsData = submissionsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setSubmissions(submissionsData);
      } catch (err: any) {
        console.error("Error fetching tasks:", err);
        setError(err.message || "Failed to load tasks");
      } finally {
        setIsLoadingTasks(false);
      }
    };
    
    fetchTasks();
  }, [selectedGroup, user]);
  
  // Task creation state
  const [taskForm, setTaskForm] = useState<CreateTaskFormValues>({
    title: "",
    description: "",
    type: "general",
    resourceLink: "",
  });
  
  // Task submission state
  const [submissionForm, setSubmissionForm] = useState<SubmitTaskFormValues>({
    submissionLink: "",
    comments: "",
  });
  
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);
  
  // Handle task form changes
  const handleTaskFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setTaskForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };
  
  // Handle task type selection
  const handleTaskTypeChange = (value: string) => {
    setTaskForm((prev) => ({
      ...prev,
      type: value as "general" | "leetcode" | "form",
    }));
  };
  
  // Handle submission form changes
  const handleSubmissionFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSubmissionForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };
  
  // Create new task
  const handleCreateTask = async () => {
    if (!user || !selectedGroup || isCreatingTask) return;
    
    try {
      setIsCreatingTask(true);
      
      // Validate task form
      const taskData = {
        title: taskForm.title.trim(),
        description: taskForm.description || "",
        type: taskForm.type,
        resourceLink: taskForm.resourceLink || "",
        creatorId: user.uid,
        groupId: selectedGroup,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Create task in Firestore
      const taskRef = await addDoc(collection(db, 'tasks'), taskData);
      
      // Add a notification message to the chat
      await addDoc(collection(db, 'messages'), {
        content: `📋 New Task: ${taskForm.title}`,
        userId: user.uid,
        groupId: selectedGroup,
        sentAt: new Date().toISOString(),
        isTaskNotification: true,
        taskId: taskRef.id
      });
      
      // Reset form
      setTaskForm({
        title: "",
        description: "",
        type: "general",
        resourceLink: "",
      });
      
      toast({
        title: "Success",
        description: "Task created successfully",
      });
      
      // Refresh tasks
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('groupId', '==', selectedGroup)
      );
      
      const tasksSnapshot = await getDocs(tasksQuery);
      const tasksData = tasksSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort tasks by creation date (newest first)
      tasksData.sort((a: any, b: any) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      setTasks(tasksData);
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
  
  // Submit task
  const handleSubmitTask = async (taskId: string) => {
    if (!user || !selectedGroup || isSubmittingTask) return;
    
    try {
      setIsSubmittingTask(true);
      
      const submissionData = {
        taskId,
        userId: user.uid,
        groupId: selectedGroup,
        submissionLink: submissionForm.submissionLink || "",
        comments: submissionForm.comments || "",
        status: "completed",
        submittedAt: new Date().toISOString(),
      };
      
      // Create submission in Firestore
      await addDoc(collection(db, 'task_submissions'), submissionData);
      
      // Add a notification message to the chat
      const taskDoc = await getDoc(doc(db, 'tasks', taskId));
      if (taskDoc.exists()) {
        const taskData = taskDoc.data();
        
        await addDoc(collection(db, 'messages'), {
          content: `✅ ${user.displayName || user.email?.split('@')[0] || "User"} completed task: ${taskData.title}`,
          userId: user.uid,
          groupId: selectedGroup,
          sentAt: new Date().toISOString(),
          isSystemMessage: true,
        });
      }
      
      // Reset form
      setSubmissionForm({
        submissionLink: "",
        comments: "",
      });
      
      toast({
        title: "Success",
        description: "Task submitted successfully",
      });
      
      // Refresh submissions
      const submissionsQuery = query(
        collection(db, 'task_submissions'),
        where('userId', '==', user.uid)
      );
      
      const submissionsSnapshot = await getDocs(submissionsQuery);
      const submissionsData = submissionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setSubmissions(submissionsData);
    } catch (err: any) {
      console.error("Error submitting task:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to submit task. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingTask(false);
    }
  };
  
  // Helper to check if user has submitted a task
  const hasUserSubmittedTask = (taskId: string) => {
    return submissions.some(submission => submission.taskId === taskId);
  };
  
  // Format date for display
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  // Loading states
  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">StudyConnect</h1>
          <p className="mb-4">Please log in to view tasks</p>
          <Button onClick={() => navigate("/auth")}>
            Go to Login
          </Button>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-neutral-light">
      <div className="flex h-screen overflow-hidden">
        {/* Desktop Sidebar */}
        <Sidebar 
          userName={user?.displayName || user?.email?.split('@')[0] || "User"} 
          userEmail={user?.email || ""} 
          userAvatar={user?.photoURL || null} 
          activeItem="tasks" 
        />
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Header */}
          <header className="bg-white border-b border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <h1 className="text-xl font-semibold text-neutral-dark">Tasks</h1>
              </div>
              {selectedGroup && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="bg-primary hover:bg-primary-dark">
                      <i className="ri-add-line mr-1"></i> New Task
                    </Button>
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
                        {!taskForm.title.trim() && (
                          <p className="text-red-500 text-sm mt-1">Title is required</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="task-description">Description</Label>
                        <Textarea 
                          id="task-description" 
                          name="description"
                          value={taskForm.description || ""}
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
                          value={taskForm.resourceLink || ""}
                          onChange={handleTaskFormChange}
                          placeholder="https://" 
                        />
                      </div>
                      <Button 
                        className="w-full"
                        onClick={handleCreateTask}
                        disabled={isCreatingTask || !taskForm.title.trim()}
                      >
                        {isCreatingTask ? "Creating..." : "Create Task"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </header>
          
          {/* Tasks Content */}
          <main className="flex-1 overflow-y-auto p-4 bg-neutral-light">
            <div className="max-w-6xl mx-auto">
              {!selectedGroup ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Select a Group</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoadingGroups ? (
                      <div className="text-center py-4">Loading groups...</div>
                    ) : error ? (
                      <div className="text-center py-4 text-red-500">Error: {error}</div>
                    ) : groups.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {groups.map((group: any) => (
                          <Card 
                            key={group.id} 
                            className="cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => setSelectedGroup(group.id)}
                          >
                            <CardContent className="pt-6">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 bg-primary rounded-full w-10 h-10 flex items-center justify-center text-white">
                                  <span className="font-semibold">{group.name?.substring(0, 2).toUpperCase() || "GR"}</span>
                                </div>
                                <div className="ml-3">
                                  <p className="font-medium">{group.name}</p>
                                  <p className="text-xs text-gray-500">
                                    {group.isAdmin ? "Admin" : "Member"}
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <p>No groups yet. Create a group first to manage tasks.</p>
                        <Button 
                          className="mt-4" 
                          onClick={() => navigate("/dashboard")}
                        >
                          Go to Dashboard
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="mb-4 flex items-center">
                    <Button 
                      variant="outline" 
                      className="mr-2"
                      onClick={() => setSelectedGroup(null)}
                    >
                      <i className="ri-arrow-left-line mr-1"></i> Back
                    </Button>
                    <h2 className="text-xl font-semibold">
                      {groups.find((g: any) => g.id === selectedGroup)?.name || "Group"} Tasks
                    </h2>
                  </div>
                  
                  <Tabs defaultValue="all" onValueChange={setActiveTab}>
                    <TabsList className="mb-4">
                      <TabsTrigger value="all">All Tasks</TabsTrigger>
                      <TabsTrigger value="pending">Pending</TabsTrigger>
                      <TabsTrigger value="completed">Completed</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="all">
                      {isLoadingTasks ? (
                        <div className="text-center py-4">Loading tasks...</div>
                      ) : error ? (
                        <div className="text-center py-4 text-red-500">Error: {error}</div>
                      ) : tasks.length > 0 ? (
                        <div className="space-y-4">
                          {tasks.map((task: any) => (
                            <Card key={task.id} className="hover:shadow-md transition-shadow">
                              <CardContent className="pt-6">
                                <div className="flex justify-between items-start">
                                  <div className="cursor-pointer" onClick={() => navigate(`/task/${task.id}`)}>
                                    <h3 className="text-lg font-semibold">{task.title}</h3>
                                    {task.description && (
                                      <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                                    )}
                                    <div className="mt-2 flex items-center flex-wrap gap-2">
                                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                                        ${task.type === 'leetcode' 
                                          ? 'bg-blue-100 text-blue-800' 
                                          : task.type === 'form' 
                                            ? 'bg-green-100 text-green-800' 
                                            : 'bg-purple-100 text-purple-800'
                                        }`}>
                                        {task.type.charAt(0).toUpperCase() + task.type.slice(1)}
                                      </span>
                                      
                                      {/* Show completion status */}
                                      {hasUserSubmittedTask(task.id) ? (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                          Completed
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                          Pending
                                        </span>
                                      )}
                                      
                                      <span className="text-xs text-gray-500">
                                        {task.createdAt && formatDate(task.createdAt)}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    {task.resourceLink && (
                                      <a 
                                        href={task.resourceLink} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-sm text-primary hover:underline inline-flex items-center"
                                      >
                                        <i className="ri-external-link-line mr-1"></i>
                                        Resource
                                      </a>
                                    )}
                                    {!hasUserSubmittedTask(task.id) && (
                                      <Dialog>
                                        <DialogTrigger asChild>
                                          <Button size="sm">Submit</Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                          <DialogHeader>
                                            <DialogTitle>Submit Task: {task.title}</DialogTitle>
                                          </DialogHeader>
                                          <div className="space-y-4 mt-2">
                                            <div>
                                              <Label htmlFor="submission-link">Submission Link (Optional)</Label>
                                              <Input 
                                                id="submission-link" 
                                                name="submissionLink"
                                                value={submissionForm.submissionLink || ""}
                                                onChange={handleSubmissionFormChange}
                                                placeholder="https://" 
                                              />
                                            </div>
                                            <div>
                                              <Label htmlFor="submission-comments">Comments (Optional)</Label>
                                              <Textarea 
                                                id="submission-comments" 
                                                name="comments"
                                                value={submissionForm.comments || ""}
                                                onChange={handleSubmissionFormChange}
                                                placeholder="Add any comments about your solution..." 
                                              />
                                            </div>
                                            <Button 
                                              className="w-full"
                                              onClick={() => handleSubmitTask(task.id)}
                                              disabled={isSubmittingTask}
                                            >
                                              {isSubmittingTask ? "Submitting..." : "Submit Task"}
                                            </Button>
                                          </div>
                                        </DialogContent>
                                      </Dialog>
                                    )}
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => navigate(`/task/${task.id}`)}
                                    >
                                      Details
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <p>No tasks found for this group.</p>
                        </div>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="pending">
                      {isLoadingTasks ? (
                        <div className="text-center py-4">Loading tasks...</div>
                      ) : error ? (
                        <div className="text-center py-4 text-red-500">Error: {error}</div>
                      ) : tasks.length > 0 ? (
                        <div className="space-y-4">
                          {tasks
                            .filter((task: any) => !hasUserSubmittedTask(task.id))
                            .map((task: any) => (
                              <Card key={task.id} className="hover:shadow-md transition-shadow">
                                <CardContent className="pt-6">
                                  <div className="flex justify-between items-start">
                                    <div className="cursor-pointer" onClick={() => navigate(`/task/${task.id}`)}>
                                      <h3 className="text-lg font-semibold">{task.title}</h3>
                                      {task.description && (
                                        <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                                      )}
                                      <div className="mt-2 flex items-center flex-wrap gap-2">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                                          ${task.type === 'leetcode' 
                                            ? 'bg-blue-100 text-blue-800' 
                                            : task.type === 'form' 
                                              ? 'bg-green-100 text-green-800' 
                                              : 'bg-purple-100 text-purple-800'
                                          }`}>
                                          {task.type.charAt(0).toUpperCase() + task.type.slice(1)}
                                        </span>
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                          Pending
                                        </span>
                                        <span className="text-xs text-gray-500">
                                          {task.createdAt && formatDate(task.createdAt)}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      {task.resourceLink && (
                                        <a 
                                          href={task.resourceLink} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-sm text-primary hover:underline inline-flex items-center"
                                        >
                                          <i className="ri-external-link-line mr-1"></i>
                                          Resource
                                        </a>
                                      )}
                                      <Dialog>
                                        <DialogTrigger asChild>
                                          <Button size="sm">Submit</Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                          <DialogHeader>
                                            <DialogTitle>Submit Task: {task.title}</DialogTitle>
                                          </DialogHeader>
                                          <div className="space-y-4 mt-2">
                                            <div>
                                              <Label htmlFor="submission-link">Submission Link (Optional)</Label>
                                              <Input 
                                                id="submission-link" 
                                                name="submissionLink"
                                                value={submissionForm.submissionLink || ""}
                                                onChange={handleSubmissionFormChange}
                                                placeholder="https://" 
                                              />
                                            </div>
                                            <div>
                                              <Label htmlFor="submission-comments">Comments (Optional)</Label>
                                              <Textarea 
                                                id="submission-comments" 
                                                name="comments"
                                                value={submissionForm.comments || ""}
                                                onChange={handleSubmissionFormChange}
                                                placeholder="Add any comments about your solution..." 
                                              />
                                            </div>
                                            <Button 
                                              className="w-full"
                                              onClick={() => handleSubmitTask(task.id)}
                                              disabled={isSubmittingTask}
                                            >
                                              {isSubmittingTask ? "Submitting..." : "Submit Task"}
                                            </Button>
                                          </div>
                                        </DialogContent>
                                      </Dialog>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => navigate(`/task/${task.id}`)}
                                      >
                                        Details
                                      </Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <p>No pending tasks found for this group.</p>
                        </div>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="completed">
                      {isLoadingTasks ? (
                        <div className="text-center py-4">Loading tasks...</div>
                      ) : error ? (
                        <div className="text-center py-4 text-red-500">Error: {error}</div>
                      ) : tasks.length > 0 ? (
                        <div className="space-y-4">
                          {tasks
                            .filter((task: any) => hasUserSubmittedTask(task.id))
                            .map((task: any) => (
                              <Card key={task.id} className="hover:shadow-md transition-shadow">
                                <CardContent className="pt-6">
                                  <div className="flex justify-between items-start">
                                    <div className="cursor-pointer" onClick={() => navigate(`/task/${task.id}`)}>
                                      <h3 className="text-lg font-semibold">{task.title}</h3>
                                      {task.description && (
                                        <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                                      )}
                                      <div className="mt-2 flex items-center flex-wrap gap-2">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                                          ${task.type === 'leetcode' 
                                            ? 'bg-blue-100 text-blue-800' 
                                            : task.type === 'form' 
                                              ? 'bg-green-100 text-green-800' 
                                              : 'bg-purple-100 text-purple-800'
                                          }`}>
                                          {task.type.charAt(0).toUpperCase() + task.type.slice(1)}
                                        </span>
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                          Completed
                                        </span>
                                        <span className="text-xs text-gray-500">
                                          {task.createdAt && formatDate(task.createdAt)}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      {task.resourceLink && (
                                        <a 
                                          href={task.resourceLink} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-sm text-primary hover:underline inline-flex items-center"
                                        >
                                          <i className="ri-external-link-line mr-1"></i>
                                          Resource
                                        </a>
                                      )}
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => navigate(`/task/${task.id}`)}
                                      >
                                        Details
                                      </Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <p>No completed tasks found for this group.</p>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </>
              )}
            </div>
          </main>
        </div>
      </div>
      
      {/* Mobile Navigation */}
      <MobileNav activeItem="tasks" />
    </div>
  );
}