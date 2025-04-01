import { Link } from "wouter";
import { 
  LayoutDashboard, 
  MessageSquare, 
  CheckSquare, 
  Trophy, 
  Settings,
  BookOpen
} from "lucide-react";

export type ActiveNavItem = 
  | "dashboard" 
  | "chat" 
  | "tasks" 
  | "leaderboard" 
  | "flashcards" 
  | "settings";

interface MobileNavProps {
  activeItem: ActiveNavItem;
}

export function MobileNav({ activeItem }: MobileNavProps) {
  const navItems = [
    { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard", id: "dashboard" },
    { path: "/chat", icon: MessageSquare, label: "Chat", id: "chat" },
    { path: "/tasks", icon: CheckSquare, label: "Tasks", id: "tasks" },
    { path: "/leaderboard", icon: Trophy, label: "Leaderboard", id: "leaderboard" },
    { path: "/flashcards", icon: BookOpen, label: "Flashcards", id: "flashcards" },
    { path: "/profile", icon: Settings, label: "Profile", id: "settings" }
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
      <div className="flex justify-around items-center">
        {navItems.map((item) => (
          <Link href={item.path} key={item.id}>
            <div className="flex flex-col items-center py-2 px-3 cursor-pointer">
              <item.icon 
                className={`h-6 w-6 ${activeItem === item.id ? "text-primary" : "text-gray-600"}`} 
              />
              <span className={`text-xs mt-1 ${activeItem === item.id ? "text-primary font-medium" : "text-gray-600"}`}>
                {item.label}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </nav>
  );
}