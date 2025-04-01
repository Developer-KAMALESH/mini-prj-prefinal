import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail,
  signOut, 
  updateProfile, 
  User 
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  collection,
  serverTimestamp
} from "firebase/firestore";

// Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.appspot.com`,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Authentication helper functions
export const signInWithGoogle = async () => {
  try {
    // Use popup method directly since redirect has issues
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error("Error signing in with Google:", error);
    
    // Check for unauthorized domain error
    if (error.code === "auth/unauthorized-domain") {
      throw new Error("Please add this domain to your Firebase authorized domains list. Go to Firebase Console > Authentication > Settings > Authorized domains and add this domain.");
    }
    
    throw error;
  }
};

// Function to handle redirect result (call this on app initialization)
export const handleGoogleRedirect = async () => {
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      // User successfully signed in with redirect
      return result.user;
    }
    return null;
  } catch (error) {
    console.error("Error with redirect sign-in:", error);
    throw error;
  }
};

export const registerWithEmail = async (email: string, password: string, name: string) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    // Update the user's profile with their name
    await updateProfile(result.user, { displayName: name });
    return result.user;
  } catch (error: any) {
    console.error("Error registering with email:", error);
    
    // Provide more user-friendly error messages
    if (error.code === "auth/email-already-in-use") {
      throw new Error("This email is already registered. Please try logging in instead.");
    }
    
    throw error;
  }
};

export const loginWithEmail = async (email: string, password: string) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error) {
    console.error("Error logging in with email:", error);
    throw error;
  }
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out:", error);
    throw error;
  }
};

// Password reset functionality
export const sendPasswordResetLink = async (email: string) => {
  try {
    await sendPasswordResetEmail(auth, email);
    return true;
  } catch (error: any) {
    console.error("Error sending password reset email:", error);
    // Provide user-friendly error messages
    if (error.code === "auth/user-not-found") {
      throw new Error("No account found with this email address.");
    }
    throw error;
  }
};

// Save or update user in Firestore
export const saveUserToFirestore = async (firebaseUser: User) => {
  if (!firebaseUser) return null;
  
  try {
    const userRef = doc(db, "users", firebaseUser.uid);
    
    // Check if the user document already exists
    const userDoc = await getDoc(userRef);
    
    let userData: any = {
      id: firebaseUser.uid,
      name: firebaseUser.displayName || "User",
      email: firebaseUser.email || "",
      username: firebaseUser.email?.split('@')[0] || "user",
      avatar: firebaseUser.photoURL || null,
      lastLogin: serverTimestamp(),
    };
    
    if (!userDoc.exists()) {
      // Create a new user document if it doesn't exist
      userData.createdAt = serverTimestamp();
      console.log("Creating new user document in Firestore:", userData);
    } else {
      console.log("Updating existing user document in Firestore");
    }
    
    // Save or update the user document
    await setDoc(userRef, userData, { merge: true });
    console.log("User saved to Firestore successfully");
    
    return userData;
  } catch (error) {
    console.error("Error saving user to Firestore:", error);
    return null;
  }
};

// Convert Firebase user to our app user format
export const convertFirebaseUser = (firebaseUser: User) => {
  console.log("Converting Firebase user:", firebaseUser);
  
  if (!firebaseUser) {
    console.log("Null or undefined Firebase user object");
    return null;
  }
  
  // Trigger saving user to Firestore (don't await, we don't want to block UI)
  saveUserToFirestore(firebaseUser).catch(error => 
    console.error("Error in background Firestore save:", error)
  );
  
  return {
    id: firebaseUser.uid,
    name: firebaseUser.displayName || "User",
    email: firebaseUser.email || "",
    username: firebaseUser.email?.split('@')[0] || "user",
    avatar: firebaseUser.photoURL || undefined
  };
};