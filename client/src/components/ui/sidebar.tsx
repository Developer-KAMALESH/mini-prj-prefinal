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
  Settings,
  BookOpen,
  LucideIcon
} from "lucide-react";

export type ActiveNavItem = 
  | "dashboard" 
  | "chat" 
  | "tasks" 
  | "leaderboard" 
  | "flashcards" 
  | "settings";

interface NavItem {
  path: string;
  icon: LucideIcon;
  label: string;
  id: ActiveNavItem;
}

interface SidebarProps {
  userName?: string;  // Made optional
  userEmail?: string; // Made optional
  userAvatar?: string | null;
  activeItem: ActiveNavItem;
}

const navItems: NavItem[] = [
  { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard", id: "dashboard" },
  { path: "/chat", icon: MessageSquare, label: "Chat", id: "chat" },
  { path: "/tasks", icon: CheckSquare, label: "Tasks", id: "tasks" },
  { path: "/leaderboard", icon: Trophy, label: "Leaderboard", id: "leaderboard" },
  { path: "/flashcards", icon: BookOpen, label: "Flashcards", id: "flashcards" },
  { path: "/profile", icon: Settings, label: "Profile", id: "settings" }
];

export function Sidebar({ userName, userEmail, userAvatar, activeItem }: SidebarProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  
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

  const getAvatarFallback = () => {
    if (!userName) return "US"; // Default fallback if no name
    
    try {
      const trimmedName = userName.trim();
      const nameParts = trimmedName.split(' ');
      return nameParts.length > 1 
        ? `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
        : trimmedName.substring(0, 2).toUpperCase();
    } catch {
      return "US"; // Fallback in case of any error
    }
  };

  return (
    <aside className="hidden md:flex md:flex-shrink-0 w-64 flex-col h-screen sticky top-0 bg-white border-r border-gray-200">
      {/* Logo Section */}
      <div className="p-4 border-b border-gray-200">
        <Link href="/dashboard" aria-label="Go to dashboard">
          <div className="flex items-center cursor-pointer">
            <h1 className="text-xl font-bold text-primary">StudySync</h1>
          </div>
        </Link>
      </div>
      
      {/* Conditionally render user profile section */}
      {(userName || userEmail) && (
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center">
            <Avatar className="h-10 w-10">
              <AvatarImage src={userAvatar || undefined} alt={userName ? `${userName}'s avatar` : "User avatar"} />
              <AvatarFallback>{getAvatarFallback()}</AvatarFallback>
            </Avatar>
            <div className="ml-3">
              {userName && <p className="font-medium truncate" title={userName}>{userName}</p>}
              {userEmail && <p className="text-sm text-gray-500 truncate" title={userEmail}>{userEmail}</p>}
            </div>
          </div>
        </div>
      )}
      
      {/* Navigation Links */}
      <nav aria-label="Main navigation" className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map(({ id, path, icon: Icon, label }) => (
            <li key={id}>
              <Link href={path}>
                <a
                  className={`flex items-center px-3 py-2 rounded-md cursor-pointer ${
                    activeItem === id
                      ? "bg-primary-light text-primary font-medium" 
                      : "text-gray-700 hover:text-primary hover:bg-primary-lighter"
                  }`}
                  aria-current={activeItem === id ? "page" : undefined}
                >
                  <Icon className="mr-3 h-5 w-5" aria-hidden="true" />
                  {label}
                </a>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      
      {/* Conditionally render logout button */}
      {user && (
        <div className="p-4 border-t border-gray-200">
          <Button 
            variant="outline" 
            className="w-full justify-start" 
            onClick={handleLogout}
            aria-label="Logout"
          >
            <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
            Logout
          </Button>
        </div>
      )}
    </aside>
  );
}