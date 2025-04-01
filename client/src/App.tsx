import { useState, useEffect, createContext, useContext } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { auth, convertFirebaseUser, handleGoogleRedirect } from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/LandingPage";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import GroupChat from "@/pages/GroupChat";
import Tasks from "@/pages/Tasks";
import TaskDetails from "@/pages/TaskDetails";
import Leaderboard from "@/pages/Leaderboard";
import Profile from "@/pages/Profile";
import Flashcards from "@/pages/Flashcards";

export type AppUser = {
  id: string;
  name: string;
  email: string;
  username: string;
  avatar?: string;
} | null;

interface AuthContextType {
  user: AppUser;
  loading: boolean;
  isInitialized: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isInitialized: false,
});

export { AuthContext };

function LoadingScreen() {
  return (
    <div className="h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">StudySync</h1>
        <p className="text-gray-500">Loading...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children, path }: { children: React.ReactNode; path: string }) {
  const { user, loading, isInitialized } = useContext(AuthContext);
  const [location] = useLocation();

  if (loading || !isInitialized) return <LoadingScreen />;
  
  if (!user) {
    return <Redirect to="/auth" />;
  }

  // Ensure the path matches exactly or is a subpath
  if (location !== path && !location.startsWith(`${path}/`)) {
    return <Redirect to={path} />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isInitialized } = useContext(AuthContext);
  const [location] = useLocation();

  if (loading || !isInitialized) return <LoadingScreen />;

  if (user && (location === '/' || location === '/auth')) {
    return <Redirect to="/dashboard" />;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/">
        <PublicRoute>
          <LandingPage />
        </PublicRoute>
      </Route>
      
      <Route path="/auth">
        <PublicRoute>
          <Auth />
        </PublicRoute>
      </Route>
      
      <Route path="/dashboard">
        <ProtectedRoute path="/dashboard">
          <Dashboard />
        </ProtectedRoute>
      </Route>
      
      <Route path="/chat/:groupId?">
        <ProtectedRoute path="/chat">
          <GroupChat />
        </ProtectedRoute>
      </Route>
      
      <Route path="/tasks">
        <ProtectedRoute path="/tasks">
          <Tasks />
        </ProtectedRoute>
      </Route>
      
      <Route path="/task/:taskId">
        <ProtectedRoute path="/task">
          <TaskDetails />
        </ProtectedRoute>
      </Route>
      
      <Route path="/leaderboard">
        <ProtectedRoute path="/leaderboard">
          <Leaderboard />
        </ProtectedRoute>
      </Route>
      
      <Route path="/flashcards">
        <ProtectedRoute path="/flashcards">
          <Flashcards />
        </ProtectedRoute>
      </Route>
      
      <Route path="/profile">
        <ProtectedRoute path="/profile">
          <Profile />
        </ProtectedRoute>
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [user, setUser] = useState<AppUser>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        await handleGoogleRedirect();
        if (isMounted) {
          setIsInitialized(true);
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (isMounted) {
        setUser(firebaseUser ? convertFirebaseUser(firebaseUser) : null);
        setLoading(false);
        setIsInitialized(true);
      }
    });

    initializeAuth();
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={{ user, loading, isInitialized }}>
        <Router />
        <Toaster />
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

export default App;