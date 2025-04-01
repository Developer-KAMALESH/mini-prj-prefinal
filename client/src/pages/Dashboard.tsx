import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LogOut } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertGroupSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { logoutUser } from "@/lib/firebase";

// Create group form schema
const createGroupSchema = insertGroupSchema;
type CreateGroupFormValues = z.infer<typeof createGroupSchema>;

export default function Dashboard() {
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const { toast } = useToast();
  const { user: firebaseUser, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !firebaseUser) {
      navigate('/auth');
    }
  }, [authLoading, firebaseUser, navigate]);

  // If still loading auth or no user, show a loading screen
  if (authLoading) {
    return <div className="h-screen flex items-center justify-center">Loading authentication data...</div>;
  }
  
  if (!firebaseUser) {
    return null; // Will redirect in useEffect
  }
  
  // Setup form for creating a new group
  const createGroupForm = useForm<CreateGroupFormValues>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });
  
  // Handle logout
  const handleLogout = async () => {
    try {
      await logoutUser();
      toast({
        title: "Logged out",
        description: "You have been successfully logged out."
      });
      navigate('/auth');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to logout. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  // Get current user
  const userQuery = useQuery({
    queryKey: ['/api/auth/me'],
  });
  
  // Get user groups
  const groupsQuery = useQuery({
    queryKey: ['/api/groups'],
    enabled: !!userQuery.data,
  });
  
  // Create group mutation
  const createGroupMutation = useMutation({
    mutationFn: (data: CreateGroupFormValues) => 
      apiRequest("POST", "/api/groups", data),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Group created successfully!",
      });
      createGroupForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create group. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  // Handle group creation
  const onCreateGroupSubmit = (data: CreateGroupFormValues) => {
    createGroupMutation.mutate(data);
  };

  // Use Firebase user data
  const user = {
    name: firebaseUser.name || "Guest", 
    email: firebaseUser.email || "guest@example.com",
    avatar: firebaseUser.avatar || null
  };
  
  return (
    <div className="min-h-screen bg-neutral-light">
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar (Desktop) */}
        <Sidebar 
          userName={user.name} 
          userEmail={user.email} 
          userAvatar={user.avatar} 
          activeItem="dashboard" 
        />
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Header */}
          <header className="bg-white border-b border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <button 
                  className="md:hidden text-neutral-dark mr-3"
                  onClick={() => setShowMobileMenu(!showMobileMenu)}
                >
                  <i className="ri-menu-line text-2xl"></i>
                </button>
                <h1 className="text-xl font-semibold text-neutral-dark md:hidden">StudyConnect</h1>
                <h1 className="text-xl font-semibold text-neutral-dark hidden md:block">Dashboard</h1>
              </div>
              <div className="flex items-center space-x-4">
                <button className="text-neutral-dark hover:text-primary">
                  <i className="ri-notification-3-line text-xl"></i>
                </button>
                <img 
                  src={user.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=80&q=80"} 
                  alt="Profile" 
                  className="h-8 w-8 rounded-full md:hidden" 
                />
              </div>
            </div>
          </header>
          
          {/* Dashboard Content */}
          <main className="flex-1 overflow-y-auto p-4 bg-neutral-light">
            {/* Welcome Section */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-semibold mb-2">Welcome back, {user.name.split(" ")[0]}!</h2>
                    <p className="text-neutral-dark/80">Here's what's happening with your study groups today.</p>
                  </div>
                  <Button variant="outline" onClick={handleLogout} className="hidden md:flex">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Stat Card 1 */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center">
                    <div className="bg-primary/10 w-12 h-12 flex items-center justify-center rounded-full">
                      <i className="ri-team-line text-xl text-primary"></i>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm text-neutral-dark/70">My Groups</p>
                      <p className="text-2xl font-semibold">{groupsQuery.data?.length || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Stat Card 2 */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center">
                    <div className="bg-green-100 w-12 h-12 flex items-center justify-center rounded-full">
                      <i className="ri-chat-3-line text-xl text-green-600"></i>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm text-neutral-dark/70">Unread Messages</p>
                      <p className="text-2xl font-semibold">0</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Stat Card 3 */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center">
                    <div className="bg-yellow-100 w-12 h-12 flex items-center justify-center rounded-full">
                      <i className="ri-task-line text-xl text-yellow-600"></i>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm text-neutral-dark/70">Pending Tasks</p>
                      <p className="text-2xl font-semibold">0</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Stat Card 4 */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center">
                    <div className="bg-red-100 w-12 h-12 flex items-center justify-center rounded-full">
                      <i className="ri-trophy-line text-xl text-red-500"></i>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm text-neutral-dark/70">Your Rank</p>
                      <p className="text-2xl font-semibold">-</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity & Groups */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Recent Activity */}
              <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Recent Activity</h3>
                  <a href="#" className="text-primary text-sm hover:text-primary-dark">View All</a>
                </div>
                {groupsQuery.data && groupsQuery.data.length > 0 ? (
                  <div className="space-y-4">
                    {/* Sample activity items */}
                    <div className="flex items-start">
                      <div className="bg-purple-100 p-2 rounded-full">
                        <i className="ri-user-add-line text-purple-600"></i>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium">You joined the platform</p>
                        <p className="text-xs text-gray-500">Just now</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No activities yet. Join or create a group to get started!</p>
                  </div>
                )}
              </div>

              {/* My Groups */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">My Groups</h3>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" className="text-sm">
                        <i className="ri-add-line mr-1"></i> New
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New Group</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={createGroupForm.handleSubmit(onCreateGroupSubmit)} className="space-y-4 mt-2">
                        <div>
                          <Label htmlFor="group-name">Group Name</Label>
                          <Input 
                            id="group-name" 
                            {...createGroupForm.register("name")}
                          />
                          {createGroupForm.formState.errors.name && (
                            <p className="text-red-500 text-sm mt-1">{createGroupForm.formState.errors.name.message}</p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="group-description">Description</Label>
                          <Textarea 
                            id="group-description" 
                            {...createGroupForm.register("description")}
                          />
                          {createGroupForm.formState.errors.description && (
                            <p className="text-red-500 text-sm mt-1">{createGroupForm.formState.errors.description.message}</p>
                          )}
                        </div>
                        <Button 
                          type="submit" 
                          className="w-full"
                          disabled={createGroupMutation.isPending}
                        >
                          {createGroupMutation.isPending ? "Creating..." : "Create Group"}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
                
                {groupsQuery.isLoading ? (
                  <div className="text-center py-4">Loading groups...</div>
                ) : groupsQuery.error ? (
                  <div className="text-center py-4 text-red-500">Error: {groupsQuery.error.message}</div>
                ) : groupsQuery.data && groupsQuery.data.length > 0 ? (
                  <div className="space-y-3">
                    {groupsQuery.data.map((group: any) => (
                      <Link key={group.id} href={`/chat/${group.id}`}>
                        <a className="block p-3 rounded-lg hover:bg-neutral-light">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 bg-primary-light rounded-full w-10 h-10 flex items-center justify-center text-white">
                              <span className="font-semibold">{group.name.substring(0, 2).toUpperCase()}</span>
                            </div>
                            <div className="ml-3">
                              <p className="font-medium">{group.name}</p>
                              <p className="text-xs text-gray-500">
                                {group.isAdmin ? "Admin" : "Member"} • Created {new Date(group.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </a>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No groups yet. Create your first group to get started!</p>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Mobile Navigation */}
      <MobileNav activeItem="dashboard" />
    </div>
  );
}
