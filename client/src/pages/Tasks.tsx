import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { z } from "zod";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTaskSchema, insertTaskSubmissionSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Task creation schema
const createTaskSchema = insertTaskSchema.omit({ creatorId: true, groupId: true });
type CreateTaskFormValues = z.infer<typeof createTaskSchema>;

// Task submission schema
const submitTaskSchema = insertTaskSubmissionSchema.pick({ submissionLink: true, status: true });
type SubmitTaskFormValues = z.infer<typeof submitTaskSchema>;

export default function Tasks() {
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const { toast } = useToast();
  
  // Get current user
  const userQuery = useQuery({
    queryKey: ['/api/auth/me'],
  });
  
  // Get user groups
  const groupsQuery = useQuery({
    queryKey: ['/api/groups'],
    enabled: !!userQuery.data,
  });
  
  // Get tasks for selected group
  const tasksQuery = useQuery({
    queryKey: [`/api/groups/${selectedGroup}/tasks`],
    enabled: !!selectedGroup && !!userQuery.data,
  });
  
  // Setup form for creating a new task
  const createTaskForm = useForm<CreateTaskFormValues>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "general",
      resourceLink: "",
    },
  });
  
  // Setup form for submitting a task
  const submitTaskForm = useForm<SubmitTaskFormValues>({
    resolver: zodResolver(submitTaskSchema),
    defaultValues: {
      submissionLink: "",
      status: "completed",
    },
  });
  
  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: (data: CreateTaskFormValues) => 
      apiRequest("POST", `/api/groups/${selectedGroup}/tasks`, data),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Task created successfully!",
      });
      createTaskForm.reset();
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${selectedGroup}/tasks`] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create task. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  // Submit task mutation
  const submitTaskMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: number, data: SubmitTaskFormValues }) => 
      apiRequest("POST", `/api/tasks/${taskId}/submit`, data),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Task submitted successfully!",
      });
      submitTaskForm.reset();
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${selectedGroup}/tasks`] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit task. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  // Handle task creation
  const onCreateTaskSubmit = (data: CreateTaskFormValues) => {
    if (selectedGroup) {
      createTaskMutation.mutate(data);
    }
  };
  
  // Handle task submission
  const onSubmitTask = (taskId: number) => {
    submitTaskMutation.mutate({ 
      taskId, 
      data: submitTaskForm.getValues() 
    });
  };
  
  // Loading states
  if (userQuery.isLoading) {
    return <div className="h-screen flex items-center justify-center">Loading user data...</div>;
  }
  
  if (userQuery.error) {
    return <div className="h-screen flex items-center justify-center">Error: {userQuery.error.message}</div>;
  }
  
  const user = userQuery.data;
  
  return (
    <div className="min-h-screen bg-neutral-light">
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar (Desktop) */}
        <Sidebar 
          userName={user.name} 
          userEmail={user.email} 
          userAvatar={user.avatar} 
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
                    <form onSubmit={createTaskForm.handleSubmit(onCreateTaskSubmit)} className="space-y-4 mt-2">
                      <div>
                        <Label htmlFor="task-title">Task Title</Label>
                        <Input 
                          id="task-title" 
                          {...createTaskForm.register("title")}
                        />
                        {createTaskForm.formState.errors.title && (
                          <p className="text-red-500 text-sm mt-1">{createTaskForm.formState.errors.title.message}</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="task-description">Description</Label>
                        <Textarea 
                          id="task-description" 
                          {...createTaskForm.register("description")}
                        />
                        {createTaskForm.formState.errors.description && (
                          <p className="text-red-500 text-sm mt-1">{createTaskForm.formState.errors.description.message}</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="task-type">Task Type</Label>
                        <Select 
                          onValueChange={(value) => createTaskForm.setValue("type", value)}
                          defaultValue={createTaskForm.getValues("type")}
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
                        {createTaskForm.formState.errors.type && (
                          <p className="text-red-500 text-sm mt-1">{createTaskForm.formState.errors.type.message}</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="task-link">Resource Link (Optional)</Label>
                        <Input 
                          id="task-link" 
                          placeholder="https://" 
                          {...createTaskForm.register("resourceLink")}
                        />
                        {createTaskForm.formState.errors.resourceLink && (
                          <p className="text-red-500 text-sm mt-1">{createTaskForm.formState.errors.resourceLink.message}</p>
                        )}
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full"
                        disabled={createTaskMutation.isPending}
                      >
                        {createTaskMutation.isPending ? "Creating..." : "Create Task"}
                      </Button>
                    </form>
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
                    {groupsQuery.isLoading ? (
                      <div className="text-center py-4">Loading groups...</div>
                    ) : groupsQuery.error ? (
                      <div className="text-center py-4 text-red-500">Error: {groupsQuery.error.message}</div>
                    ) : groupsQuery.data && groupsQuery.data.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {groupsQuery.data.map((group: any) => (
                          <Card 
                            key={group.id} 
                            className="cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => setSelectedGroup(group.id)}
                          >
                            <CardContent className="pt-6">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 bg-primary rounded-full w-10 h-10 flex items-center justify-center text-white">
                                  <span className="font-semibold">{group.name.substring(0, 2).toUpperCase()}</span>
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
                          onClick={() => window.location.href = "/dashboard"}
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
                      {groupsQuery.data?.find((g: any) => g.id === selectedGroup)?.name} Tasks
                    </h2>
                  </div>
                  
                  <Tabs defaultValue="all">
                    <TabsList className="mb-4">
                      <TabsTrigger value="all">All Tasks</TabsTrigger>
                      <TabsTrigger value="pending">Pending</TabsTrigger>
                      <TabsTrigger value="completed">Completed</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="all">
                      {tasksQuery.isLoading ? (
                        <div className="text-center py-4">Loading tasks...</div>
                      ) : tasksQuery.error ? (
                        <div className="text-center py-4 text-red-500">Error: {tasksQuery.error.message}</div>
                      ) : tasksQuery.data && tasksQuery.data.length > 0 ? (
                        <div className="space-y-4">
                          {tasksQuery.data.map((task: any) => (
                            <Card key={task.id}>
                              <CardContent className="pt-6">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <h3 className="text-lg font-semibold">{task.title}</h3>
                                    <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                                    <div className="mt-2 flex items-center">
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                        {task.type.charAt(0).toUpperCase() + task.type.slice(1)}
                                      </span>
                                      {task.resourceLink && (
                                        <a 
                                          href={task.resourceLink} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="ml-2 text-sm text-primary hover:underline"
                                        >
                                          View Resource
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button>Submit Task</Button>
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
                                            placeholder="https://" 
                                            {...submitTaskForm.register("submissionLink")}
                                          />
                                        </div>
                                        <div>
                                          <Label htmlFor="submission-status">Status</Label>
                                          <Select 
                                            onValueChange={(value) => submitTaskForm.setValue("status", value)}
                                            defaultValue="completed"
                                          >
                                            <SelectTrigger id="submission-status">
                                              <SelectValue placeholder="Select status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="completed">Completed</SelectItem>
                                              <SelectItem value="pending">In Progress</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <Button 
                                          onClick={() => onSubmitTask(task.id)}
                                          className="w-full"
                                          disabled={submitTaskMutation.isPending}
                                        >
                                          {submitTaskMutation.isPending ? "Submitting..." : "Submit"}
                                        </Button>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <p>No tasks have been created yet.</p>
                          {groupsQuery.data?.find((g: any) => g.id === selectedGroup)?.isAdmin && (
                            <p className="mt-2">Click "New Task" to create one.</p>
                          )}
                        </div>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="pending">
                      <div className="text-center py-8 text-gray-500">
                        <p>Pending tasks will appear here.</p>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="completed">
                      <div className="text-center py-8 text-gray-500">
                        <p>Completed tasks will appear here.</p>
                      </div>
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
