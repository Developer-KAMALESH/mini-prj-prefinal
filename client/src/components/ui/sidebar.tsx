import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { logoutUser } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  MessageSquare, 
  CheckSquare, 
  Trophy, 
  LogOut, 
  Settings 
} from "lucide-react";

interface SidebarProps {
  userName: string;
  userEmail: string;
  userAvatar?: string | null;
  activeItem: "dashboard" | "chat" | "tasks" | "leaderboard" | "settings";
}

export function Sidebar({ userName, userEmail, userAvatar, activeItem }: SidebarProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
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
  
  return (
    <aside className="hidden md:flex w-64 flex-col bg-white border-r border-gray-200">
      {/* Logo and Profile */}
      <div className="p-4 border-b border-gray-200">
        <Link href="/dashboard">
          <div className="flex items-center cursor-pointer">
            <h1 className="text-xl font-bold text-primary">StudyConnect</h1>
          </div>
        </Link>
      </div>
      
      {/* User Profile */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center">
          <Avatar className="h-10 w-10">
            <AvatarImage 
              src={userAvatar || undefined} 
              alt={userName} 
            />
            <AvatarFallback>{userName.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="ml-3">
            <p className="font-medium">{userName}</p>
            <p className="text-sm text-gray-500">{userEmail}</p>
          </div>
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          <li>
            <Link href="/dashboard">
              <div className={`flex items-center px-3 py-2 rounded-md cursor-pointer ${
                activeItem === "dashboard" 
                ? "bg-primary-light text-primary font-medium" 
                : "text-gray-700 hover:text-primary hover:bg-primary-lighter"
              }`}>
                <LayoutDashboard className="mr-3 h-5 w-5" />
                Dashboard
              </div>
            </Link>
          </li>
          <li>
            <Link href="/chat">
              <div className={`flex items-center px-3 py-2 rounded-md cursor-pointer ${
                activeItem === "chat" 
                ? "bg-primary-light text-primary font-medium" 
                : "text-gray-700 hover:text-primary hover:bg-primary-lighter"
              }`}>
                <MessageSquare className="mr-3 h-5 w-5" />
                Chat
              </div>
            </Link>
          </li>
          <li>
            <Link href="/tasks">
              <div className={`flex items-center px-3 py-2 rounded-md cursor-pointer ${
                activeItem === "tasks" 
                ? "bg-primary-light text-primary font-medium" 
                : "text-gray-700 hover:text-primary hover:bg-primary-lighter"
              }`}>
                <CheckSquare className="mr-3 h-5 w-5" />
                Tasks
              </div>
            </Link>
          </li>
          <li>
            <Link href="/leaderboard">
              <div className={`flex items-center px-3 py-2 rounded-md cursor-pointer ${
                activeItem === "leaderboard" 
                ? "bg-primary-light text-primary font-medium" 
                : "text-gray-700 hover:text-primary hover:bg-primary-lighter"
              }`}>
                <Trophy className="mr-3 h-5 w-5" />
                Leaderboard
              </div>
            </Link>
          </li>
        </ul>
      </nav>
      
      {/* Bottom Actions */}
      <div className="p-4 border-t border-gray-200">
        <Button variant="outline" className="w-full justify-start" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </aside>
  );
}