import { useState, useRef, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { ChatMessage } from "@/components/ui/chat-message";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { insertMessageSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function GroupChat() {
  const { groupId } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Get current user
  const userQuery = useQuery({
    queryKey: ['/api/auth/me'],
  });
  
  // Get selected group
  const groupQuery = useQuery({
    queryKey: [`/api/groups/${groupId}`],
    enabled: !!groupId && !!userQuery.data,
  });
  
  // Get group members
  const membersQuery = useQuery({
    queryKey: [`/api/groups/${groupId}/members`],
    enabled: !!groupId && !!userQuery.data,
  });
  
  // Get messages
  const messagesQuery = useQuery({
    queryKey: [`/api/groups/${groupId}/messages`],
    enabled: !!groupId && !!userQuery.data,
    refetchInterval: 5000, // Poll for new messages every 5 seconds
  });
  
  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (content: string) => 
      apiRequest("POST", `/api/groups/${groupId}/messages`, { content }),
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}/messages`] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messagesQuery.data]);
  
  // Handle message sending
  const handleSendMessage = () => {
    if (message.trim() && !sendMessageMutation.isPending) {
      sendMessageMutation.mutate(message);
    }
  };
  
  // Handle key press (send on Enter)
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  // Loading states
  if (userQuery.isLoading) {
    return <div className="h-screen flex items-center justify-center">Loading user data...</div>;
  }
  
  if (userQuery.error) {
    return <div className="h-screen flex items-center justify-center">Error: {userQuery.error.message}</div>;
  }
  
  const user = userQuery.data;
  const group = groupQuery.data;
  
  return (
    <div className="min-h-screen bg-neutral-light">
      <div className="flex h-screen overflow-hidden">
        {/* Chat Sidebar (Desktop) */}
        <aside className="hidden md:flex w-72 flex-col bg-white border-r border-gray-200">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h1 className="text-xl font-semibold text-neutral-dark">Chats</h1>
            <button className="text-neutral-dark hover:text-primary">
              <i className="ri-edit-line text-xl"></i>
            </button>
          </div>
          
          <div className="px-3 py-3 border-b border-gray-200">
            <input 
              type="text" 
              placeholder="Search chats..." 
              className="w-full px-3 py-2 bg-neutral-light rounded-lg text-sm"
            />
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {/* Chat List */}
            {userQuery.data && (
              <div className="p-2">
                {groupQuery.isLoading ? (
                  <div className="p-3 text-center">Loading groups...</div>
                ) : groupQuery.error ? (
                  <div className="p-3 text-center text-red-500">Error loading groups</div>
                ) : (
                  <>
                    {/* Display group here */}
                    <a href="#" className="flex items-center p-3 bg-primary/10 rounded-lg mb-1">
                      <div className="flex-shrink-0 bg-primary rounded-full w-10 h-10 flex items-center justify-center text-white">
                        <span className="font-semibold">{group?.name.substring(0, 2).toUpperCase()}</span>
                      </div>
                      <div className="ml-3 flex-1">
                        <div className="flex justify-between">
                          <p className="font-medium text-primary">{group?.name}</p>
                          <p className="text-xs text-primary">Now</p>
                        </div>
                        <p className="text-xs text-neutral-dark truncate">
                          {membersQuery.data?.length || 0} members
                        </p>
                      </div>
                    </a>
                  </>
                )}
              </div>
            )}
          </div>
          
          <div className="p-4 border-t border-gray-200">
            <button 
              className="flex items-center text-primary hover:text-primary-dark"
              onClick={() => navigate("/dashboard")}
            >
              <i className="ri-dashboard-line mr-2"></i> Back to Dashboard
            </button>
          </div>
        </aside>

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
                <div className="flex-shrink-0 bg-primary rounded-full w-10 h-10 flex items-center justify-center text-white">
                  <span className="font-semibold">{group?.name.substring(0, 2).toUpperCase()}</span>
                </div>
                <div className="ml-3">
                  <p className="font-semibold">{group?.name}</p>
                  <p className="text-xs text-gray-500">
                    {membersQuery.data?.length || 0} members • {membersQuery.data ? membersQuery.data.filter((m: any) => m.user.id !== user.id).length : 0} others
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
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
            {messagesQuery.isLoading ? (
              <div className="h-full flex items-center justify-center">
                Loading messages...
              </div>
            ) : messagesQuery.error ? (
              <div className="h-full flex items-center justify-center text-red-500">
                Error loading messages: {messagesQuery.error.message}
              </div>
            ) : messagesQuery.data && messagesQuery.data.length > 0 ? (
              <div className="space-y-4">
                {/* Date Separator */}
                <div className="flex items-center justify-center">
                  <div className="bg-gray-200 px-3 py-1 rounded-full text-xs text-gray-500">Today</div>
                </div>
                
                {/* Messages */}
                {messagesQuery.data.map((msg: any) => (
                  <ChatMessage
                    key={msg.id}
                    content={msg.content}
                    time={msg.sentAt}
                    user={msg.user}
                    currentUserId={user.id}
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
                disabled={!message.trim() || sendMessageMutation.isPending}
                aria-label="Send message"
              >
                <i className="ri-send-plane-fill"></i>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <MobileNav activeItem="chats" />
    </div>
  );
}
