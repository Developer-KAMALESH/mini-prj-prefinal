import { useState, useEffect, useCallback } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { auth, logoutUser, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where, addDoc } from "firebase/firestore";

// Create group form schema
const createGroupSchema = insertGroupSchema;
type CreateGroupFormValues = z.infer<typeof createGroupSchema>;

// User type definition
type AppUser = {
  id: string;
  name: string;
  email: string;
  username: string;
  avatar?: string | null;
};

export default function Dashboard() {
  // Basic state
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [authLoading, setAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  
  // Setup form for creating a new group
  const createGroupForm = useForm<CreateGroupFormValues>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });
  
  // Get Firebase auth state
  useEffect(() => {
    console.log("Setting up auth listener in Dashboard");
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("Auth state changed in Dashboard:", user ? "user logged in" : "user logged out");
      
      if (user) {
        // User is signed in
        setCurrentUser({
          id: user.uid,
          name: user.displayName || user.email?.split('@')[0] || "User",
          email: user.email || "",
          username: user.email?.split('@')[0] || "user",
          avatar: user.photoURL || null
        });
      } else {
        // User is signed out
        setCurrentUser(null);
      }
      
      setAuthLoading(false);
    });
    
    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);
  
  // Fetch groups from Firestore when user changes
  useEffect(() => {
    const fetchGroups = async () => {
      if (!currentUser) return;
      
      try {
        console.log("Fetching groups for user:", currentUser.id);
        setGroupsLoading(true);
        
        // Get user's groups (as admin)
        const adminGroupsQuery = query(
          collection(db, 'groups'),
          where('creatorId', '==', currentUser.id)
        );
        const adminGroupsSnapshot = await getDocs(adminGroupsQuery);
        const adminGroups = adminGroupsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          isAdmin: true
        }));
        
        console.log("Admin groups:", adminGroups);
        
        // Get groups the user is a member of
        const membershipQuery = query(
          collection(db, 'group_members'),
          where('userId', '==', currentUser.id)
        );
        const membershipSnapshot = await getDocs(membershipQuery);
        
        // Fetch the actual group data for each membership
        const memberGroups = await Promise.all(
          membershipSnapshot.docs.map(async (doc) => {
            const groupId = doc.data().groupId;
            const groupDoc = await getDocs(query(
              collection(db, 'groups'),
              where('id', '==', groupId)
            ));
            
            if (groupDoc.docs.length > 0) {
              return {
                id: groupDoc.docs[0].id,
                ...groupDoc.docs[0].data(),
                isAdmin: false
              };
            }
            return null;
          })
        );
        
        console.log("Member groups:", memberGroups.filter(g => g !== null));
        
        // Combine admin groups and member groups, filtering out nulls
        const allGroups = [...adminGroups, ...memberGroups.filter(g => g !== null)];
        console.log("All groups:", allGroups);
        
        setGroups(allGroups);
        setGroupsLoading(false);
      } catch (error) {
        console.error("Error fetching groups:", error);
        toast({
          title: "Error",
          description: "Failed to load groups. Please try again.",
          variant: "destructive"
        });
        setGroupsLoading(false);
      }
    };
    
    fetchGroups();
  }, [currentUser, toast]);
  
  // Handle logout
  const handleLogout = useCallback(async () => {
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
  }, [toast, navigate]);
  
  // Create group mutation - using Firestore directly
  const handleCreateGroup = useCallback(async (data: CreateGroupFormValues) => {
    if (!currentUser) return;
    
    try {
      // Add the group to Firestore
      const groupRef = await addDoc(collection(db, 'groups'), {
        name: data.name,
        description: data.description,
        creatorId: currentUser.id,
        createdAt: new Date().toISOString()
      });
      
      // Add the creator as a member/admin
      await addDoc(collection(db, 'group_members'), {
        groupId: groupRef.id,
        userId: currentUser.id,
        role: 'admin',
        joinedAt: new Date().toISOString()
      });
      
      toast({
        title: "Success",
        description: "Group created successfully!",
      });
      
      createGroupForm.reset();
      
      // Refresh groups
      const newGroup = {
        id: groupRef.id,
        name: data.name,
        description: data.description,
        creatorId: currentUser.id,
        createdAt: new Date().toISOString(),
        isAdmin: true
      };
      
      setGroups(prevGroups => [...prevGroups, newGroup]);
      
    } catch (error) {
      console.error("Error creating group:", error);
      toast({
        title: "Error",
        description: "Failed to create group. Please try again.",
        variant: "destructive",
      });
    }
  }, [currentUser, toast, createGroupForm]);
  
  // Loading state
  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-xl">Loading user data...</p>
      </div>
    );
  }
  
  // Not logged in state - we shouldn't hit this with the auth redirects in App.tsx
  // but keeping it for safety
  if (!currentUser) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">StudySync</h1>
          <p className="mb-4">Please log in to access the dashboard</p>
          <Button onClick={() => navigate('/auth')}>
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  // Main dashboard UI when logged in
  return (
    <div className="min-h-screen bg-neutral-light">
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar (Desktop) */}
        <Sidebar 
          userName={currentUser.name}
          userEmail={currentUser.email}
          userAvatar={currentUser.avatar}
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
                <h1 className="text-xl font-semibold text-neutral-dark md:hidden">StudySync</h1>
                <h1 className="text-xl font-semibold text-neutral-dark hidden md:block">Dashboard</h1>
              </div>
              <div className="flex items-center space-x-4">
                <Dialog>
                  <DialogTrigger asChild>
                    <button className="text-neutral-dark hover:text-primary">
                      <i className="ri-notification-3-line text-xl"></i>
                    </button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Notifications</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 text-center text-gray-500">
                      <p>No new notifications.</p>
                    </div>
                  </DialogContent>
                </Dialog>
                <img 
                  src={currentUser.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=80&q=80"} 
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
                    <h2 className="text-xl font-semibold mb-2">Welcome back, {currentUser.name.split(" ")[0]}!</h2>
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
                      <p className="text-2xl font-semibold">{groups.length || 0}</p>
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
                <div className="space-y-4">
                  {groups.length > 0 ? (
                    <div className="flex items-start">
                      <div className="bg-purple-100 p-2 rounded-full">
                        <i className="ri-user-add-line text-purple-600"></i>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium">You are active in {groups.length} {groups.length === 1 ? 'group' : 'groups'}</p>
                        <p className="text-xs text-gray-500">Current status</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <p>No activities yet. Join or create a group to get started!</p>
                    </div>
                  )}
                </div>
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
                      <form onSubmit={createGroupForm.handleSubmit(handleCreateGroup)} className="space-y-4 mt-2">
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
                        >
                          Create Group
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
                
                {groupsLoading ? (
                  <div className="text-center py-4">Loading groups...</div>
                ) : groups.length > 0 ? (
                  <div className="space-y-3">
                    {groups.map((group) => (
                      <Link key={group.id} href={`/chat/${group.id}`}>
                        <div className="block p-3 rounded-lg hover:bg-neutral-light cursor-pointer">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 bg-primary/80 rounded-full w-10 h-10 flex items-center justify-center text-white">
                              <span className="font-semibold">{group.name.substring(0, 2).toUpperCase()}</span>
                            </div>
                            <div className="ml-3">
                              <p className="font-medium">{group.name}</p>
                              <p className="text-xs text-gray-500">
                                {group.isAdmin ? "Admin" : "Member"} • Created {new Date(group.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>
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
