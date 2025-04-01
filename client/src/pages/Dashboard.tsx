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
  const [filteredGroups, setFilteredGroups] = useState<any[]>([]);
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
            const groupDoc = await db.collection('groups').doc(groupId).get();
            if (groupDoc.exists) {
              return {
                id: groupId,
                ...groupDoc.data(),
                isAdmin: false
              };
            }
            return null;
          })
        );
        
        // Filter out any nulls and combine both arrays
        const validMemberGroups = memberGroups.filter(g => g !== null);
        const allGroups = [...adminGroups, ...validMemberGroups];
        console.log("All groups:", allGroups);
        
        setGroups(allGroups);
        setFilteredGroups(allGroups);
        
      } catch (error) {
        console.error("Error fetching groups:", error);
        toast({
          title: "Error",
          description: "Failed to load your groups. Please try again later.",
          variant: "destructive",
        });
      } finally {
        setGroupsLoading(false);
      }
    };
    
    fetchGroups();
  }, [currentUser, toast]);
  
  const handleCreateGroup = useCallback(async (data: CreateGroupFormValues) => {
    if (!currentUser) return;
    
    try {
      // Add new group to Firestore
      const groupData = {
        ...data,
        creatorId: currentUser.id,
        creatorName: currentUser.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      const docRef = await addDoc(collection(db, 'groups'), groupData);
      
      // Also add creator as a member
      await addDoc(collection(db, 'group_members'), {
        userId: currentUser.id,
        groupId: docRef.id,
        joinedAt: new Date().toISOString(),
        role: 'admin'
      });
      
      toast({
        title: "Success!",
        description: `Group "${data.name}" has been created.`,
      });
      
      // Add to local state
      const newGroup = {
        id: docRef.id,
        ...groupData,
        isAdmin: true
      };
      
      setGroups(prev => [...prev, newGroup]);
      setFilteredGroups(prev => [...prev, newGroup]);
      
      // Reset form and close dialog
      createGroupForm.reset();
      document.getElementById('close-create-group-dialog')?.click();
      
    } catch (error) {
      console.error("Error creating group:", error);
      toast({
        title: "Error",
        description: "Failed to create group. Please try again.",
        variant: "destructive",
      });
    }
  }, [currentUser, createGroupForm, toast]);
  
  // Handle form submission
  const onCreateGroupSubmit = createGroupForm.handleSubmit(handleCreateGroup);
  
  // Handle logout
  const handleLogout = async () => {
    try {
      await logoutUser();
      navigate("/auth");
    } catch (error) {
      console.error("Error logging out:", error);
      toast({
        title: "Error",
        description: "Failed to log out. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }
  
  // Redirect to auth page if not logged in
  if (!currentUser) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-4">Please Login</h1>
          <p className="mb-4">You need to be logged in to view this page.</p>
          <Button onClick={() => navigate("/auth")}>Go to Login</Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-neutral-light">
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <Sidebar 
          activeItem="dashboard" 
          userName={currentUser.name}
          userEmail={currentUser.email}
          userAvatar={currentUser.avatar}
        />
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="bg-white border-b border-gray-200 py-4 px-6 flex items-center justify-between">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-800">Dashboard</h1>
            </div>
            
            {/* User menu */}
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium hidden md:inline-block">
                {currentUser.name}
              </span>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={handleLogout}
                title="Logout"
              >
                <LogOut className="h-5 w-5" />
              </Button>
              
              {/* Create new group button (dialog trigger) */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm">Create Group</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create a New Study Group</DialogTitle>
                  </DialogHeader>
                  
                  <form onSubmit={onCreateGroupSubmit} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Group Name</Label>
                      <Input
                        id="name"
                        placeholder="Enter group name"
                        {...createGroupForm.register("name")}
                      />
                      {createGroupForm.formState.errors.name && (
                        <div className="py-4 text-center text-gray-500">
                          <p className="text-red-500 text-xs">
                            {createGroupForm.formState.errors.name.message}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        placeholder="Enter group description"
                        {...createGroupForm.register("description")}
                      />
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <Button
                        type="button"
                        variant="outline"
                        id="close-create-group-dialog"
                        onClick={() => createGroupForm.reset()}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createGroupForm.formState.isSubmitting}>
                        {createGroupForm.formState.isSubmitting ? "Creating..." : "Create Group"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </header>
          
          {/* Main Content */}
          <main className="flex-1 overflow-y-auto p-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Total Groups */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="bg-primary/10 w-12 h-12 flex items-center justify-center rounded-full">
                      <i className="ri-group-line text-xl text-primary"></i>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm text-neutral-dark/70">Total Groups</p>
                      <p className="text-2xl font-semibold">{groups.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Completed Tasks */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="bg-green-100 w-12 h-12 flex items-center justify-center rounded-full">
                      <i className="ri-check-line text-xl text-green-600"></i>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm text-neutral-dark/70">Completed Tasks</p>
                      <p className="text-2xl font-semibold">-</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Pending Tasks */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="bg-yellow-100 w-12 h-12 flex items-center justify-center rounded-full">
                      <i className="ri-time-line text-xl text-yellow-600"></i>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm text-neutral-dark/70">Pending Tasks</p>
                      <p className="text-2xl font-semibold">-</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Rank */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="bg-red-100 w-12 h-12 flex items-center justify-center rounded-full">
                      <i className="ri-medal-line text-xl text-red-600"></i>
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
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/groups/discover">Find Groups</Link>
                  </Button>
                </div>
                {groupsLoading ? (
                  <div className="text-center py-4">Loading groups...</div>
                ) : groups.length > 0 ? (
                  <div>
                    <div className="mb-3 relative">
                      <Input
                        type="text"
                        placeholder="Search groups..."
                        className="w-full pl-9"
                        onChange={(e) => {
                          // Implement group filtering
                          const searchTerm = e.target.value.toLowerCase();
                          if (!searchTerm) {
                            // Reset to show all groups if search is empty
                            setFilteredGroups(groups);
                          } else {
                            // Filter groups by name or description
                            const filtered = groups.filter(
                              group => 
                                group.name.toLowerCase().includes(searchTerm) || 
                                (group.description && group.description.toLowerCase().includes(searchTerm))
                            );
                            setFilteredGroups(filtered);
                          }
                        }}
                      />
                      <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                        <i className="ri-search-line"></i>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {filteredGroups.map((group) => (
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