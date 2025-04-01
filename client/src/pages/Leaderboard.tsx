import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

export default function Leaderboard() {
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
  
  // Get leaderboard for selected group
  const leaderboardQuery = useQuery({
    queryKey: [`/api/groups/${selectedGroup}/leaderboard`],
    enabled: !!selectedGroup && !!userQuery.data,
  });
  
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
                <CardHeader>
                  <CardTitle>Group Leaderboard</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Select Group
                    </label>
                    <Select 
                      onValueChange={(value) => setSelectedGroup(parseInt(value))}
                      value={selectedGroup?.toString()}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a group" />
                      </SelectTrigger>
                      <SelectContent>
                        {groupsQuery.isLoading ? (
                          <SelectItem value="loading" disabled>Loading groups...</SelectItem>
                        ) : groupsQuery.error ? (
                          <SelectItem value="error" disabled>Error loading groups</SelectItem>
                        ) : groupsQuery.data && groupsQuery.data.length > 0 ? (
                          groupsQuery.data.map((group: any) => (
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
                  
                  {selectedGroup ? (
                    leaderboardQuery.isLoading ? (
                      <div className="text-center py-4">Loading leaderboard data...</div>
                    ) : leaderboardQuery.error ? (
                      <div className="text-center py-4 text-red-500">
                        Error: {leaderboardQuery.error.message}
                      </div>
                    ) : leaderboardQuery.data && leaderboardQuery.data.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[80px]">Rank</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead className="text-right">Score</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {leaderboardQuery.data.map((item: any, index: number) => (
                            <TableRow key={item.user.id} className={item.user.id === user.id ? "bg-primary/5" : ""}>
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
