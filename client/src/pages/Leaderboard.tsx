import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Award, Medal } from "lucide-react";

export default function Leaderboard() {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [timeframe, setTimeframe] = useState("all"); // all, monthly, weekly
  
  // Fetch user's groups
  useEffect(() => {
    if (!user) return;
    
    const fetchGroups = async () => {
      try {
        setLoading(true);
        console.log("Fetching groups for user:", user.id);
        
        // Get all groups where user is a member
        const groupMembersRef = collection(db, "group_members");
        const q = query(groupMembersRef, where("userId", "==", user.id));
        const querySnapshot = await getDocs(q);
        
        console.log(`Found ${querySnapshot.size} group memberships`);
        
        // Extract group IDs from the memberships
        const userGroupIds = querySnapshot.docs.map(docSnapshot => {
          const data = docSnapshot.data();
          console.log("Group member data:", data);
          return data.groupId;
        });
        
        if (userGroupIds.length === 0) {
          console.log("User is not a member of any groups");
          setGroups([]);
          setLoading(false);
          return;
        }
        
        console.log("User's group IDs:", userGroupIds);
        
        // Fetch each group document by ID
        const groupsData: any[] = [];
        
        for (const groupId of userGroupIds) {
          try {
            console.log(`Fetching group with ID: ${groupId}`);
            
            // Get the group document by ID
            const groupDocRef = doc(db, "groups", groupId);
            const groupDoc = await getDoc(groupDocRef);
            
            if (groupDoc.exists()) {
              const groupData = groupDoc.data();
              console.log("Retrieved group data:", { id: groupId, ...groupData });
              
              groupsData.push({
                id: groupId, // Use the document ID
                name: groupData.name,
                description: groupData.description,
                createdAt: groupData.createdAt,
                creatorId: groupData.creatorId
              });
            } else {
              console.log(`Group document with ID ${groupId} does not exist`);
            }
          } catch (err) {
            console.error(`Error fetching group with ID ${groupId}:`, err);
          }
        }
        
        console.log(`Successfully retrieved ${groupsData.length} groups`);
        setGroups(groupsData);
        
        // Auto-select first group if available
        if (groupsData.length > 0 && !selectedGroupId) {
          console.log(`Auto-selecting first group: ${groupsData[0].id}`);
          setSelectedGroupId(groupsData[0].id);
          fetchLeaderboardData(groupsData[0].id, timeframe);
        }
        
      } catch (error) {
        console.error("Error fetching groups:", error);
        toast({
          title: "Error",
          description: "Failed to load groups. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchGroups();
  }, [user, toast, timeframe]);
  
  // Fetch leaderboard data when group is selected
  const fetchLeaderboardData = async (groupId: string, timeframeFilter: string) => {
    if (!groupId) return;
    
    try {
      setLoadingLeaderboard(true);
      
      // Get all task submissions for the group
      const tasksRef = collection(db, "tasks");
      const taskQuery = query(tasksRef, where("groupId", "==", groupId));
      const taskSnapshot = await getDocs(taskQuery);
      
      const taskIds = taskSnapshot.docs.map(doc => doc.id); // Use document ID directly
      
      if (taskIds.length === 0) {
        setLeaderboardData([]);
        setLoadingLeaderboard(false);
        return;
      }
      
      // Get submissions for those tasks
      const submissionsRef = collection(db, "task_submissions");
      let submissionsQuery;
      
      const now = new Date();
      let startDate = new Date();
      
      if (timeframeFilter === "weekly") {
        startDate.setDate(now.getDate() - 7); // Last 7 days
      } else if (timeframeFilter === "monthly") {
        startDate.setMonth(now.getMonth() - 1); // Last month
      } else {
        // All time, no date filtering
        startDate = new Date(0); // Beginning of time
      }
      
      if (timeframeFilter === "all") {
        submissionsQuery = query(
          submissionsRef,
          where("taskId", "in", taskIds)
        );
      } else {
        submissionsQuery = query(
          submissionsRef,
          where("taskId", "in", taskIds),
          where("submittedAt", ">=", startDate.toISOString())
        );
      }
      
      const submissionsSnapshot = await getDocs(submissionsQuery);
      
      // Calculate scores by user
      const userScores: Record<string, { score: number; user: any }> = {};
      
      // Get all users to avoid multiple queries
      const usersRef = collection(db, "users");
      const usersSnapshot = await getDocs(usersRef);
      const usersMap = new Map();
      
      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        usersMap.set(userData.id.toString(), userData);
      });
      
      // Process submissions
      for (const doc of submissionsSnapshot.docs) {
        const submission = doc.data();
        const userId = submission.userId.toString();
        const taskScore = submission.score || 10; // Default score if not specified
        
        if (!userScores[userId]) {
          // Get user data
          const user = usersMap.get(userId);
          
          if (user) {
            userScores[userId] = {
              score: taskScore,
              user: {
                id: user.id,
                name: user.name,
                email: user.email,
                username: user.username || user.email.split('@')[0],
                avatar: user.avatar
              }
            };
          }
        } else {
          userScores[userId].score += taskScore;
        }
      }
      
      // Convert to array and sort by score
      const leaderboard = Object.values(userScores).sort((a, b) => b.score - a.score);
      
      setLeaderboardData(leaderboard);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      toast({
        title: "Error",
        description: "Failed to load leaderboard data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingLeaderboard(false);
    }
  };
  
  // Handle group selection change
  const handleGroupChange = (groupId: string) => {
    setSelectedGroupId(groupId);
    fetchLeaderboardData(groupId, timeframe);
  };
  
  // Handle timeframe change
  const handleTimeframeChange = (selectedTimeframe: string) => {
    setTimeframe(selectedTimeframe);
    if (selectedGroupId) {
      fetchLeaderboardData(selectedGroupId, selectedTimeframe);
    }
  };
  
  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">StudySync</h1>
          <p className="mb-4">Please log in to view the leaderboard</p>
          <Button onClick={() => navigate('/auth')}>
            Go to Login
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-neutral-light">
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar (Desktop) */}
        <Sidebar 
          userName={user.name} 
          userEmail={user.email} 
          userAvatar={user.avatar} 
          activeItem="leaderboard" 
        />
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Header */}
          <header className="bg-white border-b border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <h1 className="text-xl font-semibold text-neutral-dark">Leaderboard</h1>
              </div>
            </div>
          </header>
          
          {/* Leaderboard Content */}
          <main className="flex-1 overflow-y-auto p-4 bg-neutral-light">
            <div className="max-w-4xl mx-auto">
              <Card className="mb-6">
                <CardHeader className="pb-2">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                    <CardTitle className="flex items-center">
                      <Trophy className="mr-2 h-5 w-5 text-primary" />
                      Group Leaderboard
                    </CardTitle>
                    
                    {/* Timeframe filter */}
                    <Tabs 
                      value={timeframe} 
                      onValueChange={handleTimeframeChange}
                      className="mt-2 md:mt-0"
                    >
                      <TabsList className="grid w-full max-w-xs grid-cols-3">
                        <TabsTrigger value="weekly">Weekly</TabsTrigger>
                        <TabsTrigger value="monthly">Monthly</TabsTrigger>
                        <TabsTrigger value="all">All Time</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Select Group
                    </label>
                    <Select 
                      onValueChange={handleGroupChange}
                      value={selectedGroupId || undefined}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a group" />
                      </SelectTrigger>
                      <SelectContent>
                        {loading ? (
                          <SelectItem value="loading" disabled>Loading groups...</SelectItem>
                        ) : groups.length > 0 ? (
                          groups.map((group: any) => (
                            <SelectItem key={group.id} value={group.id.toString()}>
                              {group.name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="none" disabled>No groups available</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {selectedGroupId ? (
                    loadingLeaderboard ? (
                      <div className="space-y-3">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ) : leaderboardData.length > 0 ? (
                      <div>
                        {/* Top 3 Users - Visual Display */}
                        <div className="flex flex-col items-center justify-center md:flex-row md:justify-around mb-8 mt-2">
                          {/* 2nd Place */}
                          {leaderboardData.length > 1 && (
                            <div className="flex flex-col items-center order-1 md:order-0 mt-4 md:mt-8">
                              <div className="relative">
                                <div className="bg-gray-400 text-white rounded-full w-16 h-16 flex items-center justify-center absolute -top-3 -right-2 md:-top-2 md:-right-1 shadow-md">
                                  <Award className="h-6 w-6" />
                                </div>
                                <img 
                                  src={leaderboardData[1].user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(leaderboardData[1].user.name)}&background=6C7693&color=fff`} 
                                  alt={leaderboardData[1].user.name} 
                                  className="h-20 w-20 rounded-full border-4 border-gray-400" 
                                />
                              </div>
                              <p className="font-semibold mt-2">{leaderboardData[1].user.name}</p>
                              <p className="text-2xl font-bold text-gray-600">{leaderboardData[1].score}</p>
                            </div>
                          )}
                          
                          {/* 1st Place */}
                          {leaderboardData.length > 0 && (
                            <div className="flex flex-col items-center order-0 md:order-1">
                              <div className="relative">
                                <div className="bg-yellow-400 text-white rounded-full w-18 h-18 flex items-center justify-center absolute -top-4 -right-2 shadow-md">
                                  <Trophy className="h-7 w-7" />
                                </div>
                                <img 
                                  src={leaderboardData[0].user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(leaderboardData[0].user.name)}&background=4f46e5&color=fff`} 
                                  alt={leaderboardData[0].user.name} 
                                  className="h-24 w-24 rounded-full border-4 border-yellow-400" 
                                />
                              </div>
                              <p className="font-semibold mt-2">{leaderboardData[0].user.name}</p>
                              <p className="text-3xl font-bold text-primary">{leaderboardData[0].score}</p>
                            </div>
                          )}
                          
                          {/* 3rd Place */}
                          {leaderboardData.length > 2 && (
                            <div className="flex flex-col items-center order-2 mt-4 md:mt-10">
                              <div className="relative">
                                <div className="bg-amber-600 text-white rounded-full w-14 h-14 flex items-center justify-center absolute -top-2 -right-1 md:-top-1 md:-right-0 shadow-md">
                                  <Medal className="h-5 w-5" />
                                </div>
                                <img 
                                  src={leaderboardData[2].user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(leaderboardData[2].user.name)}&background=B65F31&color=fff`} 
                                  alt={leaderboardData[2].user.name} 
                                  className="h-18 w-18 rounded-full border-4 border-amber-600" 
                                />
                              </div>
                              <p className="font-semibold mt-2">{leaderboardData[2].user.name}</p>
                              <p className="text-xl font-bold text-amber-600">{leaderboardData[2].score}</p>
                            </div>
                          )}
                        </div>
                        
                        {/* Complete Leaderboard Table */}
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[80px]">Rank</TableHead>
                              <TableHead>User</TableHead>
                              <TableHead className="text-right">Score</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {leaderboardData.map((item: any, index: number) => (
                              <TableRow 
                                key={item.user.id} 
                                className={item.user.id === user.id ? "bg-primary/5 font-medium" : ""}
                              >
                                <TableCell className="font-medium">
                                  {index === 0 && (
                                    <span className="inline-flex items-center justify-center w-6 h-6 bg-yellow-400 text-white rounded-full">
                                      1
                                    </span>
                                  )}
                                  {index === 1 && (
                                    <span className="inline-flex items-center justify-center w-6 h-6 bg-gray-400 text-white rounded-full">
                                      2
                                    </span>
                                  )}
                                  {index === 2 && (
                                    <span className="inline-flex items-center justify-center w-6 h-6 bg-amber-600 text-white rounded-full">
                                      3
                                    </span>
                                  )}
                                  {index > 2 && (
                                    <span className="inline-flex items-center justify-center w-6 h-6 bg-gray-200 text-gray-700 rounded-full">
                                      {index + 1}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="flex items-center">
                                  <img 
                                    src={item.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.user.name)}&background=4f46e5&color=fff`} 
                                    alt={item.user.name} 
                                    className="h-8 w-8 rounded-full mr-2" 
                                  />
                                  <div>
                                    <div className="font-medium">
                                      {item.user.name} 
                                      {item.user.id === user.id && <span className="ml-2 text-primary text-xs">(You)</span>}
                                    </div>
                                    <div className="text-xs text-gray-500">@{item.user.username}</div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right font-bold">{item.score}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <p>No scores recorded yet. Complete tasks to appear on the leaderboard!</p>
                      </div>
                    )
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <p>Select a group to view its leaderboard</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>

      {/* Mobile Navigation */}
      <MobileNav activeItem="leaderboard" />
    </div>
  );
}
