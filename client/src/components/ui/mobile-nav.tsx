import { Link } from "wouter";
import { 
  LayoutDashboard, 
  MessageSquare, 
  CheckSquare, 
  Trophy, 
  Settings 
} from "lucide-react";

interface MobileNavProps {
  activeItem: "dashboard" | "chat" | "tasks" | "leaderboard" | "settings";
}

export function MobileNav({ activeItem }: MobileNavProps) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
      <div className="flex justify-around items-center">
        <Link href="/dashboard">
          <a className="flex flex-col items-center py-2 px-3">
            <LayoutDashboard 
              className={`h-6 w-6 ${activeItem === "dashboard" ? "text-primary" : "text-gray-600"}`} 
            />
            <span className={`text-xs mt-1 ${activeItem === "dashboard" ? "text-primary font-medium" : "text-gray-600"}`}>
              Dashboard
            </span>
          </a>
        </Link>
        
        <Link href="/chat">
          <a className="flex flex-col items-center py-2 px-3">
            <MessageSquare 
              className={`h-6 w-6 ${activeItem === "chat" ? "text-primary" : "text-gray-600"}`} 
            />
            <span className={`text-xs mt-1 ${activeItem === "chat" ? "text-primary font-medium" : "text-gray-600"}`}>
              Chat
            </span>
          </a>
        </Link>
        
        <Link href="/tasks">
          <a className="flex flex-col items-center py-2 px-3">
            <CheckSquare 
              className={`h-6 w-6 ${activeItem === "tasks" ? "text-primary" : "text-gray-600"}`} 
            />
            <span className={`text-xs mt-1 ${activeItem === "tasks" ? "text-primary font-medium" : "text-gray-600"}`}>
              Tasks
            </span>
          </a>
        </Link>
        
        <Link href="/leaderboard">
          <a className="flex flex-col items-center py-2 px-3">
            <Trophy 
              className={`h-6 w-6 ${activeItem === "leaderboard" ? "text-primary" : "text-gray-600"}`} 
            />
            <span className={`text-xs mt-1 ${activeItem === "leaderboard" ? "text-primary font-medium" : "text-gray-600"}`}>
              Leaderboard
            </span>
          </a>
        </Link>
      </div>
    </nav>
  );
}