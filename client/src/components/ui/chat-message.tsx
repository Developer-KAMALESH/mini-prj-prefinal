import { User } from "@shared/schema";

type ChatMessageProps = {
  content: string;
  time: string;
  user: User;
  currentUserId: number;
  isTaskNotification?: boolean;
};

export function ChatMessage({ content, time, user, currentUserId, isTaskNotification = false }: ChatMessageProps) {
  const isCurrentUser = user.id === currentUserId;
  
  // Format time
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isTaskNotification) {
    return (
      <div className="flex justify-center">
        <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-lg shadow-sm text-sm text-center">
          <p className="font-medium">{content}</p>
          <p className="text-xs">
            {time} • <a href="#" className="text-primary hover:underline">View Details</a>
          </p>
        </div>
      </div>
    );
  }

  if (isCurrentUser) {
    return (
      <div className="flex flex-row-reverse items-end">
        <img 
          src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=4f46e5&color=fff`} 
          alt={user.name} 
          className="h-8 w-8 rounded-full ml-2" 
        />
        <div className="flex flex-col items-end">
          <span className="text-xs text-gray-500 mr-2 mb-1">
            You • {formatTime(time)}
          </span>
          <div className="bg-primary text-white p-3 rounded-t-lg rounded-bl-lg shadow-sm max-w-xs sm:max-w-md" style={{ borderRadius: '1.25rem 1.25rem 0.25rem 1.25rem' }}>
            <p>{content}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-end">
      <img 
        src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=4f46e5&color=fff`} 
        alt={user.name} 
        className="h-8 w-8 rounded-full mr-2" 
      />
      <div className="flex flex-col">
        <span className="text-xs text-gray-500 ml-2 mb-1">
          {user.name} • {formatTime(time)}
        </span>
        <div className="bg-white p-3 rounded-t-lg rounded-br-lg shadow-sm max-w-xs sm:max-w-md" style={{ borderRadius: '1.25rem 1.25rem 1.25rem 0.25rem' }}>
          <p>{content}</p>
        </div>
      </div>
    </div>
  );
}
