import { useState, useEffect, createContext, useContext } from "react";
import { Switch, Route, useLocation } from "wouter";
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

type AuthContextType = {
  user: AppUser;
  loading: boolean;
};

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

function Router() {
  const [location, setLocation] = useLocation();
  const { user, loading } = useContext(AuthContext);

  // Handle authentication redirects
  useEffect(() => {
    // For now, only redirect authenticated users from login page to dashboard
    if (!loading && user && (location.startsWith("/auth") || location === "/")) {
      setLocation("/dashboard");
    }
    
    // Debug output
    console.log("Router checking auth state - Loading:", loading, "User:", user, "Location:", location);
  }, [user, loading, location, setLocation]);

  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/auth" component={Auth} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/chat/:groupId?" component={GroupChat} />
      <Route path="/tasks" component={Tasks} />
      <Route path="/task/:taskId" component={TaskDetails} />
      <Route path="/leaderboard" component={Leaderboard} />
      <Route path="/flashcards" component={Flashcards} />
      <Route path="/profile" component={Profile} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [user, setUser] = useState<AppUser>(null);
  const [loading, setLoading] = useState(true);

  // Handle Google redirect on app initialization
  useEffect(() => {
    const checkRedirect = async () => {
      try {
        // This will check if user comes from a redirect and handle the authentication
        const redirectUser = await handleGoogleRedirect();
        if (redirectUser) {
          console.log("User authenticated via redirect:", redirectUser.email);
          // Auth state listener will handle setting the user
        }
      } catch (error) {
        console.error("Error handling redirect:", error);
      }
    };

    checkRedirect();
  }, []);

  // Listen for Firebase auth state changes
  useEffect(() => {
    setLoading(true);
    console.log("Setting up auth state listener");
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      console.log("Auth state changed:", firebaseUser ? "user logged in" : "user logged out");
      if (firebaseUser) {
        // User is signed in
        const appUser = convertFirebaseUser(firebaseUser);
        setUser(appUser);
      } else {
        // User is signed out
        setUser(null);
      }
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={{ user, loading }}>
        <Router />
        <Toaster />
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

export default App;
