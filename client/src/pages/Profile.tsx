import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { auth, db } from "@/lib/firebase";
import { updateProfile } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Save } from "lucide-react";
import 'remixicon/fonts/remixicon.css';

// User profile schema
const profileSchema = z.object({
  displayName: z.string().min(2, "Display name must be at least 2 characters").optional(),
  githubUsername: z.string().optional(),
  leetcodeUsername: z.string().optional(),
  linkedinUrl: z.string().url("Please enter a valid LinkedIn URL").optional().or(z.literal("")),
  bio: z.string().max(200, "Bio must be less than 200 characters").optional(),
});

export default function Profile() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  // Use the current auth.currentUser directly
  const [user, setUser] = useState(auth.currentUser);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [profile, setProfile] = useState({
    displayName: "",
    githubUsername: "",
    leetcodeUsername: "",
    linkedinUrl: "",
    bio: "",
  });
  
  // Keep track of the current Firebase user
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
      
      // If user is logged in, fetch their profile data
      if (firebaseUser) {
        fetchUserProfile(firebaseUser.uid);
      }
    });
    return () => unsubscribe();
  }, []);
  
  // Fetch user profile from Firestore
  const fetchUserProfile = async (userId: string) => {
    try {
      const userDocRef = doc(db, 'users', userId);
      const userDocSnap = await getDoc(userDocRef);
      
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        setProfile({
          displayName: user?.displayName || "",
          githubUsername: userData.githubUsername || "",
          leetcodeUsername: userData.leetcodeUsername || "",
          linkedinUrl: userData.linkedinUrl || "",
          bio: userData.bio || "",
        });
      } else {
        // If no profile exists yet, initialize with Firebase user data
        setProfile({
          displayName: user?.displayName || "",
          githubUsername: "",
          leetcodeUsername: "",
          linkedinUrl: "",
          bio: "",
        });
      }
    } catch (err) {
      console.error("Error fetching user profile:", err);
      toast({
        title: "Error",
        description: "Failed to load your profile data. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfile(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Save profile
  const handleSaveProfile = async () => {
    if (!user) return;
    
    try {
      setSaving(true);
      
      // Validate profile data
      const validation = profileSchema.safeParse(profile);
      if (!validation.success) {
        const errors = validation.error.format();
        let errorMessage = "Invalid profile data:";
        if (errors.displayName?._errors?.[0]) errorMessage += ` ${errors.displayName._errors[0]}`;
        if (errors.linkedinUrl?._errors?.[0]) errorMessage += ` ${errors.linkedinUrl._errors[0]}`;
        if (errors.bio?._errors?.[0]) errorMessage += ` ${errors.bio._errors[0]}`;
        
        toast({
          title: "Validation Error",
          description: errorMessage,
          variant: "destructive",
        });
        setSaving(false);
        return;
      }
      
      // Update Firebase Auth display name if it changed
      if (profile.displayName && profile.displayName !== user.displayName) {
        await updateProfile(user, { displayName: profile.displayName });
      }
      
      // Save profile to Firestore
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        id: user.uid,
        name: profile.displayName || user.displayName || user.email?.split('@')[0] || "User",
        email: user.email || "",
        avatar: user.photoURL || null,
        githubUsername: profile.githubUsername || null,
        leetcodeUsername: profile.leetcodeUsername || null,
        linkedinUrl: profile.linkedinUrl || null,
        bio: profile.bio || null,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      
      toast({
        title: "Success",
        description: "Your profile has been updated successfully.",
      });
    } catch (err: any) {
      console.error("Error saving profile:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to update your profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };
  
  // Loading state
  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">StudyConnect</h1>
          <p className="mb-4">Please log in to access your profile</p>
          <Button onClick={() => navigate('/auth')}>
            Go to Login
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-neutral-light">
      <div className="flex min-h-screen">
        {/* Desktop Sidebar */}
        <Sidebar 
          userName={user.displayName || user.email?.split('@')[0] || "User"} 
          userEmail={user.email || ""} 
          userAvatar={user.photoURL || null} 
          activeItem="settings" // Use settings for profile
        />
        
        {/* Main Content */}
        <div className="flex-1 p-6">
          <h1 className="text-2xl font-bold mb-6">Your Profile</h1>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Profile Card */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Profile Picture</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center text-center">
                <Avatar className="h-32 w-32 mb-4">
                  <AvatarImage src={user.photoURL || undefined} alt={profile.displayName} />
                  <AvatarFallback className="text-2xl">
                    {profile.displayName?.substring(0, 2).toUpperCase() || 
                     user.email?.substring(0, 2).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <h3 className="text-lg font-semibold">{profile.displayName || user.email?.split('@')[0]}</h3>
                <p className="text-sm text-gray-500">{user.email}</p>
                
                <Separator className="my-4" />
                
                <p className="text-sm text-gray-600 mb-4">
                  {profile.bio || "No bio yet. Add a short description about yourself."}
                </p>
                
                <div className="w-full space-y-2">
                  {profile.githubUsername && (
                    <a 
                      href={`https://github.com/${profile.githubUsername}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center text-sm text-gray-700 hover:text-primary"
                    >
                      <i className="ri-github-fill mr-2 text-lg"></i>
                      {profile.githubUsername}
                    </a>
                  )}
                  
                  {profile.leetcodeUsername && (
                    <a 
                      href={`https://leetcode.com/${profile.leetcodeUsername}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center text-sm text-gray-700 hover:text-primary"
                    >
                      <i className="ri-code-s-slash-line mr-2 text-lg"></i>
                      {profile.leetcodeUsername}
                    </a>
                  )}
                  
                  {profile.linkedinUrl && (
                    <a 
                      href={profile.linkedinUrl}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center text-sm text-gray-700 hover:text-primary"
                    >
                      <i className="ri-linkedin-fill mr-2 text-lg"></i>
                      LinkedIn
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* Edit Profile Form */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Edit Profile</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="displayName">Display Name</Label>
                      <Input 
                        id="displayName"
                        name="displayName"
                        value={profile.displayName}
                        onChange={handleChange}
                        placeholder="Your name"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input 
                        id="email"
                        value={user.email || ""}
                        disabled
                        className="bg-gray-100"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="githubUsername">GitHub Username</Label>
                      <Input 
                        id="githubUsername"
                        name="githubUsername"
                        value={profile.githubUsername}
                        onChange={handleChange}
                        placeholder="yourusername"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="leetcodeUsername">LeetCode Username</Label>
                      <Input 
                        id="leetcodeUsername"
                        name="leetcodeUsername"
                        value={profile.leetcodeUsername}
                        onChange={handleChange}
                        placeholder="yourusername"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
                    <Input 
                      id="linkedinUrl"
                      name="linkedinUrl"
                      value={profile.linkedinUrl}
                      onChange={handleChange}
                      placeholder="https://linkedin.com/in/yourusername"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Input
                      id="bio"
                      name="bio"
                      value={profile.bio}
                      onChange={handleChange}
                      placeholder="Tell us about yourself"
                      className="h-24"
                    />
                    <p className="text-xs text-gray-500">
                      {profile.bio?.length || 0}/200 characters
                    </p>
                  </div>
                  
                  <Button 
                    className="w-full md:w-auto"
                    onClick={handleSaveProfile}
                    disabled={saving}
                  >
                    {saving ? (
                      <span>Saving...</span>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Profile
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      {/* Mobile Navigation */}
      <MobileNav activeItem="settings" />
    </div>
  );
}