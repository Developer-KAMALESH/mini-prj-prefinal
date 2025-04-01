import { Link } from "wouter";
import { 
  LayoutDashboard, 
  MessageSquare, 
  CheckSquare, 
  Trophy, 
  Settings,
  BookOpen
} from "lucide-react";

interface MobileNavProps {
  activeItem: "dashboard" | "chat" | "tasks" | "leaderboard" | "flashcards" | "settings";
}

export function MobileNav({ activeItem }: MobileNavProps) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
      <div className="flex justify-around items-center">
        <Link href="/dashboard">
          <div className="flex flex-col items-center py-2 px-3 cursor-pointer">
            <LayoutDashboard 
              className={`h-6 w-6 ${activeItem === "dashboard" ? "text-primary" : "text-gray-600"}`} 
            />
            <span className={`text-xs mt-1 ${activeItem === "dashboard" ? "text-primary font-medium" : "text-gray-600"}`}>
              Dashboard
            </span>
          </div>
        </Link>
        
        <Link href="/chat">
          <div className="flex flex-col items-center py-2 px-3 cursor-pointer">
            <MessageSquare 
              className={`h-6 w-6 ${activeItem === "chat" ? "text-primary" : "text-gray-600"}`} 
            />
            <span className={`text-xs mt-1 ${activeItem === "chat" ? "text-primary font-medium" : "text-gray-600"}`}>
              Chat
            </span>
          </div>
        </Link>
        
        <Link href="/tasks">
          <div className="flex flex-col items-center py-2 px-3 cursor-pointer">
            <CheckSquare 
              className={`h-6 w-6 ${activeItem === "tasks" ? "text-primary" : "text-gray-600"}`} 
            />
            <span className={`text-xs mt-1 ${activeItem === "tasks" ? "text-primary font-medium" : "text-gray-600"}`}>
              Tasks
            </span>
          </div>
        </Link>
        
        <Link href="/leaderboard">
          <div className="flex flex-col items-center py-2 px-3 cursor-pointer">
            <Trophy 
              className={`h-6 w-6 ${activeItem === "leaderboard" ? "text-primary" : "text-gray-600"}`} 
            />
            <span className={`text-xs mt-1 ${activeItem === "leaderboard" ? "text-primary font-medium" : "text-gray-600"}`}>
              Leaderboard
            </span>
          </div>
        </Link>
        
        <Link href="/flashcards">
          <div className="flex flex-col items-center py-2 px-3 cursor-pointer">
            <BookOpen 
              className={`h-6 w-6 ${activeItem === "flashcards" ? "text-primary" : "text-gray-600"}`} 
            />
            <span className={`text-xs mt-1 ${activeItem === "flashcards" ? "text-primary font-medium" : "text-gray-600"}`}>
              Flashcards
            </span>
          </div>
        </Link>
        
        <Link href="/profile">
          <div className="flex flex-col items-center py-2 px-3 cursor-pointer">
            <Settings 
              className={`h-6 w-6 ${activeItem === "settings" ? "text-primary" : "text-gray-600"}`} 
            />
            <span className={`text-xs mt-1 ${activeItem === "settings" ? "text-primary font-medium" : "text-gray-600"}`}>
              Profile
            </span>
          </div>
        </Link>
      </div>
    </nav>
  );
}