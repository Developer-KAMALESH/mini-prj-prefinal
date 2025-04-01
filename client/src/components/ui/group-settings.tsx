import { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { 
  MoreVertical, 
  Users, 
  Settings, 
  Trash2, 
  UserPlus, 
  Edit, 
  Save,
  Shield,
  UserMinus
} from "lucide-react";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { 
  doc, 
  collection, 
  updateDoc, 
  deleteDoc, 
  getDocs,
  query,
  where,
  addDoc,
  getDoc
} from "firebase/firestore";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type GroupSettingsProps = {
  groupId: string;
  groupData: any;
  currentUserId: string;
  onUpdate?: () => void;
};

export function GroupSettings({ groupId, groupData, currentUserId, onUpdate }: GroupSettingsProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [groupForm, setGroupForm] = useState({
    name: groupData?.name || "",
    description: groupData?.description || ""
  });
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  
  const isCreator = groupData?.creatorId === currentUserId;
  
  // Fetch members when dialog opens
  useEffect(() => {
    if (isOpen && groupId) {
      fetchGroupMembers();
    }
  }, [isOpen, groupId]);
  
  // Fetch group members
  const fetchGroupMembers = async () => {
    try {
      setLoading(true);
      
      // Get all members of this group
      const membersQuery = query(
        collection(db, 'group_members'),
        where('groupId', '==', groupId)
      );
      
      const membersSnapshot = await getDocs(membersQuery);
      const membersData: any[] = [];
      
      // For each member, get their user data
      for (const memberDoc of membersSnapshot.docs) {
        const memberData = memberDoc.data();
        const userDoc = await getDoc(doc(db, 'users', memberData.userId));
        
        if (userDoc.exists()) {
          membersData.push({
            id: memberDoc.id,
            ...memberData,
            user: {
              id: userDoc.id,
              ...userDoc.data()
            }
          });
        }
      }
      
      setMembers(membersData);
    } catch (error: any) {
      console.error("Error fetching group members:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load group members",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Handle saving group edits
  const handleSaveGroupEdits = async () => {
    try {
      if (!groupForm.name.trim()) {
        toast({
          title: "Error",
          description: "Group name is required",
          variant: "destructive",
        });
        return;
      }
      
      await updateDoc(doc(db, 'groups', groupId), {
        name: groupForm.name,
        description: groupForm.description,
        updatedAt: new Date().toISOString()
      });
      
      toast({
        title: "Success",
        description: "Group details updated successfully",
      });
      
      setEditMode(false);
      
      // Call onUpdate if provided
      if (onUpdate) {
        onUpdate();
      }
    } catch (error: any) {
      console.error("Error updating group:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update group details",
        variant: "destructive",
      });
    }
  };
  
  // Handle adding a new member
  const handleAddMember = async () => {
    try {
      if (!newMemberEmail.trim()) {
        toast({
          title: "Error",
          description: "Email is required",
          variant: "destructive",
        });
        return;
      }
      
      setAddingMember(true);
      
      // Find user by email
      const usersQuery = query(
        collection(db, 'users'),
        where('email', '==', newMemberEmail.trim())
      );
      
      const usersSnapshot = await getDocs(usersQuery);
      
      if (usersSnapshot.empty) {
        toast({
          title: "Error",
          description: "No user found with this email",
          variant: "destructive",
        });
        return;
      }
      
      const userData = usersSnapshot.docs[0];
      const userId = userData.id;
      
      // Check if user is already a member
      const memberQuery = query(
        collection(db, 'group_members'),
        where('groupId', '==', groupId),
        where('userId', '==', userId)
      );
      
      const memberSnapshot = await getDocs(memberQuery);
      
      if (!memberSnapshot.empty) {
        toast({
          title: "Error",
          description: "User is already a member of this group",
          variant: "destructive",
        });
        return;
      }
      
      // Add user to group
      await addDoc(collection(db, 'group_members'), {
        groupId,
        userId,
        isAdmin: false,
        joinedAt: new Date().toISOString()
      });
      
      // Refresh members list
      fetchGroupMembers();
      
      setNewMemberEmail("");
      
      toast({
        title: "Success",
        description: "Member added successfully",
      });
      
      // Add notification message to the chat
      await addDoc(collection(db, 'messages'), {
        content: `👋 ${userData.data().name || userData.data().email} has been added to the group`,
        userId: currentUserId,
        groupId: groupId,
        sentAt: new Date().toISOString(),
        isSystemMessage: true
      });
      
    } catch (error: any) {
      console.error("Error adding member:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to add member",
        variant: "destructive",
      });
    } finally {
      setAddingMember(false);
    }
  };
  
  // Handle removing a member
  const handleRemoveMember = async (memberId: string, memberUserId: string, memberName: string) => {
    try {
      // Remove member from group
      await deleteDoc(doc(db, 'group_members', memberId));
      
      // Refresh members list
      setMembers(prev => prev.filter(m => m.id !== memberId));
      
      toast({
        title: "Success",
        description: "Member removed successfully",
      });
      
      // Add notification message to the chat
      await addDoc(collection(db, 'messages'), {
        content: `👋 ${memberName} has been removed from the group`,
        userId: currentUserId,
        groupId: groupId,
        sentAt: new Date().toISOString(),
        isSystemMessage: true
      });
      
    } catch (error: any) {
      console.error("Error removing member:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to remove member",
        variant: "destructive",
      });
    }
  };
  
  // Handle promoting/demoting a member
  const handleToggleAdmin = async (memberId: string, memberUserId: string, isCurrentlyAdmin: boolean, memberName: string) => {
    try {
      // Update member admin status
      await updateDoc(doc(db, 'group_members', memberId), {
        isAdmin: !isCurrentlyAdmin
      });
      
      // Refresh members list
      setMembers(prev => prev.map(m => {
        if (m.id === memberId) {
          return { ...m, isAdmin: !isCurrentlyAdmin };
        }
        return m;
      }));
      
      toast({
        title: "Success",
        description: `Member ${isCurrentlyAdmin ? 'demoted' : 'promoted'} successfully`,
      });
      
      // Add notification message to the chat
      await addDoc(collection(db, 'messages'), {
        content: `🛡️ ${memberName} has been ${isCurrentlyAdmin ? 'demoted from' : 'promoted to'} admin`,
        userId: currentUserId,
        groupId: groupId,
        sentAt: new Date().toISOString(),
        isSystemMessage: true
      });
      
    } catch (error: any) {
      console.error("Error updating member status:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update member status",
        variant: "destructive",
      });
    }
  };
  
  // Handle deleting the group
  const handleDeleteGroup = async () => {
    try {
      // Delete group
      await deleteDoc(doc(db, 'groups', groupId));
      
      // Delete all group members
      const membersQuery = query(
        collection(db, 'group_members'),
        where('groupId', '==', groupId)
      );
      
      const membersSnapshot = await getDocs(membersQuery);
      
      const deletePromises = membersSnapshot.docs.map((memberDoc) => {
        return deleteDoc(doc(db, 'group_members', memberDoc.id));
      });
      
      await Promise.all(deletePromises);
      
      // Delete all messages
      const messagesQuery = query(
        collection(db, 'messages'),
        where('groupId', '==', groupId)
      );
      
      const messagesSnapshot = await getDocs(messagesQuery);
      
      const deleteMessagePromises = messagesSnapshot.docs.map((messageDoc) => {
        return deleteDoc(doc(db, 'messages', messageDoc.id));
      });
      
      await Promise.all(deleteMessagePromises);
      
      // Delete all tasks
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('groupId', '==', groupId)
      );
      
      const tasksSnapshot = await getDocs(tasksQuery);
      
      const deleteTaskPromises = tasksSnapshot.docs.map((taskDoc) => {
        return deleteDoc(doc(db, 'tasks', taskDoc.id));
      });
      
      await Promise.all(deleteTaskPromises);
      
      toast({
        title: "Success",
        description: "Group deleted successfully",
      });
      
      // Redirect to dashboard
      window.location.href = "/dashboard";
      
    } catch (error: any) {
      console.error("Error deleting group:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete group",
        variant: "destructive",
      });
    }
  };
  
  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Group Settings</DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="members">Members</TabsTrigger>
            </TabsList>
            
            {/* General Settings Tab */}
            <TabsContent value="general" className="space-y-4 mt-4">
              {editMode ? (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="group-name">Group Name</Label>
                    <Input 
                      id="group-name" 
                      value={groupForm.name}
                      onChange={(e) => setGroupForm(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="group-description">Description</Label>
                    <Textarea 
                      id="group-description" 
                      value={groupForm.description}
                      onChange={(e) => setGroupForm(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
                    <Button onClick={handleSaveGroupEdits}>
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-lg">{groupData?.name}</h3>
                        <p className="text-sm text-gray-500 mt-1">{groupData?.description}</p>
                        <p className="text-xs text-gray-400 mt-2">
                          Created: {new Date(groupData?.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      {isCreator && (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => setEditMode(true)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {isCreator && (
                <div className="mt-6">
                  <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <Button 
                      variant="destructive" 
                      className="w-full"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Group
                    </Button>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the group, 
                          all messages, and remove all members from the group.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteGroup}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </TabsContent>
            
            {/* Members Tab */}
            <TabsContent value="members" className="mt-4">
              {isCreator && (
                <div className="mb-4">
                  <div className="flex space-x-2">
                    <Input 
                      placeholder="Add member by email" 
                      value={newMemberEmail}
                      onChange={(e) => setNewMemberEmail(e.target.value)}
                    />
                    <Button 
                      onClick={handleAddMember}
                      disabled={addingMember}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add
                    </Button>
                  </div>
                </div>
              )}
              
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {loading ? (
                  <div className="text-center py-4">Loading members...</div>
                ) : members.length > 0 ? (
                  members.map((member) => (
                    <div 
                      key={member.id} 
                      className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm"
                    >
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white">
                          {member.user.name ? member.user.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div className="ml-3">
                          <p className="font-medium">{member.user.name || member.user.email}</p>
                          <div className="flex items-center text-xs text-gray-500">
                            {member.isAdmin && (
                              <div className="flex items-center text-primary mr-2">
                                <Shield className="h-3 w-3 mr-1" />
                                Admin
                              </div>
                            )}
                            <span>{member.user.email}</span>
                          </div>
                        </div>
                      </div>
                      
                      {isCreator && member.userId !== currentUserId && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => handleToggleAdmin(
                                member.id, 
                                member.userId, 
                                member.isAdmin,
                                member.user.name || member.user.email
                              )}
                            >
                              <Shield className="h-4 w-4 mr-2" />
                              {member.isAdmin ? "Remove Admin" : "Make Admin"}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-red-500"
                              onClick={() => handleRemoveMember(
                                member.id, 
                                member.userId,
                                member.user.name || member.user.email
                              )}
                            >
                              <UserMinus className="h-4 w-4 mr-2" />
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    No members found.
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}