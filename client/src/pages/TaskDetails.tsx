import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { auth, db } from "@/lib/firebase";
import { verifyLeetCodeCompletion } from "@/lib/graphql";
import { useToast } from "@/hooks/use-toast";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  orderBy,
} from "firebase/firestore";
import { ExternalLink, Check, X, Clock, AlertCircle } from "lucide-react";

export default function TaskDetails() {
  const { taskId } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // States
  const [user, setUser] = useState(auth.currentUser);
  const [task, setTask] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [group, setGroup] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submissionForm, setSubmissionForm] = useState({
    submissionLink: "",
    comments: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [leetCodeVerification, setLeetCodeVerification] = useState<{
    status: "idle" | "checking" | "success" | "error";
    message: string;
  }>({
    status: "idle",
    message: "",
  });

  // Keep track of the current Firebase user
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
    });
    return () => unsubscribe();
  }, []);

  // Fetch task data and user profile
  useEffect(() => {
    if (!taskId || !user) return;

    const fetchTaskDetails = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch task
        const taskDoc = await getDoc(doc(db, "tasks", taskId));
        if (!taskDoc.exists()) {
          setError("Task not found");
          return;
        }

        const taskData = { id: taskDoc.id, ...taskDoc.data() } as { id: string; groupId: string; [key: string]: any };
        setTask(taskData);

        // Fetch group data
        const groupDoc = await getDoc(doc(db, "groups", taskData.groupId));
        if (groupDoc.exists()) {
          setGroup({ id: groupDoc.id, ...groupDoc.data() });

          // Check if user is admin
          if (groupDoc.data().creatorId === user.uid) {
            setIsAdmin(true);
          } else {
            // Check if the user is an admin via group_members
            const membersQuery = query(
              collection(db, "group_members"),
              where("groupId", "==", taskData.groupId),
              where("userId", "==", user.uid)
            );
            const membersSnapshot = await getDocs(membersQuery);
            if (!membersSnapshot.empty) {
              const memberData = membersSnapshot.docs[0].data();
              if (memberData.isAdmin) {
                setIsAdmin(true);
              }
            }
          }
        }

        // Fetch submissions
        const submissionsQuery = query(
          collection(db, "task_submissions"),
          where("taskId", "==", taskId)
        );
        const submissionsSnapshot = await getDocs(submissionsQuery);
        const submissionsData: any[] = [];

        for (const submissionDoc of submissionsSnapshot.docs) {
          const submissionData = submissionDoc.data();
          // Get user data for this submission
          const userDoc = await getDoc(doc(db, "users", submissionData.userId));
          
          submissionsData.push({
            id: submissionDoc.id,
            ...submissionData,
            user: userDoc.exists() 
              ? { id: userDoc.id, ...userDoc.data() } 
              : { id: submissionData.userId, name: "Unknown User" }
          });
        }

        setSubmissions(submissionsData);

        // Get user profile for LeetCode verification
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          setUserProfile({ id: userDoc.id, ...userDoc.data() });
        }
      } catch (err: any) {
        console.error("Error fetching task details:", err);
        setError(err.message || "Failed to load task details");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTaskDetails();
  }, [taskId, user]);

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSubmissionForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Verify LeetCode submission
  const verifyLeetCodeSubmission = async () => {
    if (!task || !userProfile || !userProfile.leetCodeUsername) {
      toast({
        title: "Error",
        description: "You need to set your LeetCode username in your profile first.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLeetCodeVerification({ status: "checking", message: "Checking LeetCode submission status..." });

      // Extract LeetCode problem slug from the resource link
      const resourceLink = task.resourceLink || "";
      // Different format possibilities:
      // https://leetcode.com/problems/two-sum/
      // https://leetcode.com/problems/two-sum/description/
      // https://leetcode.com/problems/two-sum/submissions/
      const problemSlug = resourceLink.split("/problems/")[1]?.split("/")[0];

      if (!problemSlug) {
        setLeetCodeVerification({
          status: "error",
          message: "Invalid LeetCode problem link. It should contain '/problems/problem-slug/'",
        });
        return;
      }

      console.log(`Verifying LeetCode submission for user ${userProfile.leetCodeUsername} and problem ${problemSlug}`);

      // Verify the submission with improved LeetCode verification system
      const result = await verifyLeetCodeCompletion(userProfile.leetCodeUsername, problemSlug);

      console.log("LeetCode verification result:", result);

      if (result && result.verified) {
        // Success! Problem is solved
        setLeetCodeVerification({
          status: "success",
          message: `Verified! You've completed "${result.problem?.title}" on LeetCode. Click submit to record your completion.`,
        });

        // Auto-fill the submission form with the LeetCode problem link and a success comment
        setSubmissionForm((prev) => ({
          ...prev,
          submissionLink: task.resourceLink,
          comments: `Successfully solved "${result.problem?.title}" (${result.problem?.difficulty} difficulty) on LeetCode.`,
        }));
      } else {
        // Failed verification
        let errorMessage = "Could not verify LeetCode submission. Try solving the problem first.";
        
        if (result && result.error) {
          errorMessage = result.error;
        } else if (result && result.problem) {
          errorMessage = `Could not verify completion of "${result.problem?.title}". Make sure you've solved this problem recently on LeetCode.`;
        }
        
        setLeetCodeVerification({
          status: "error",
          message: errorMessage,
        });
      }
    } catch (err: any) {
      console.error("Error verifying LeetCode submission:", err);
      setLeetCodeVerification({
        status: "error",
        message: err.message || "Failed to verify LeetCode submission",
      });
    }
  };

  // Submit the task
  const handleSubmitTask = async () => {
    if (!user || !taskId || isSubmitting) return;

    try {
      setIsSubmitting(true);

      // Check if this is a LeetCode task that requires verification
      if (
        task.type === "leetcode" &&
        leetCodeVerification.status !== "success" &&
        userProfile?.leetCodeUsername
      ) {
        // Verify first
        await verifyLeetCodeSubmission();
        // Check status again after verification
        // Use type assertion to help TypeScript understand this comparison
        const currentStatus = leetCodeVerification.status;
        const isNotSuccess = currentStatus !== "success";
        if (isNotSuccess) {
          return; // Don't submit if verification failed (only proceed if "success")
        }
      }

      // Create submission in Firestore
      const submissionData = {
        taskId,
        userId: user.uid,
        groupId: task.groupId,
        submissionLink: submissionForm.submissionLink,
        comments: submissionForm.comments,
        status: "completed",
        submittedAt: new Date().toISOString(),
      };

      await addDoc(collection(db, "task_submissions"), submissionData);

      // Add notification message to the chat
      await addDoc(collection(db, "messages"), {
        content: `✅ ${user.displayName || user.email?.split("@")[0] || "User"} completed task: ${task.title}`,
        userId: user.uid,
        groupId: task.groupId,
        sentAt: new Date().toISOString(),
        isSystemMessage: true,
      });

      toast({
        title: "Success",
        description: "Task submitted successfully",
      });

      // Reset form and refresh submissions
      setSubmissionForm({
        submissionLink: "",
        comments: "",
      });
      setLeetCodeVerification({
        status: "idle",
        message: "",
      });

      // Refresh submissions
      const submissionsQuery = query(
        collection(db, "task_submissions"),
        where("taskId", "==", taskId)
      );
      const submissionsSnapshot = await getDocs(submissionsQuery);
      const submissionsData: any[] = [];

      for (const submissionDoc of submissionsSnapshot.docs) {
        const submissionData = submissionDoc.data();
        const userDoc = await getDoc(doc(db, "users", submissionData.userId));
        
        submissionsData.push({
          id: submissionDoc.id,
          ...submissionData,
          user: userDoc.exists() 
            ? { id: userDoc.id, ...userDoc.data() } 
            : { id: submissionData.userId, name: "Unknown User" }
        });
      }

      setSubmissions(submissionsData);
    } catch (err: any) {
      console.error("Error submitting task:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to submit task. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete task (admin only)
  const handleDeleteTask = async () => {
    if (!user || !taskId || !isAdmin) return;

    try {
      // Delete task
      await deleteDoc(doc(db, "tasks", taskId));

      // Delete all submissions for this task
      const submissionsQuery = query(
        collection(db, "task_submissions"),
        where("taskId", "==", taskId)
      );
      const submissionsSnapshot = await getDocs(submissionsQuery);
      
      const deletePromises = submissionsSnapshot.docs.map((submissionDoc) => {
        return deleteDoc(doc(db, "task_submissions", submissionDoc.id));
      });
      
      await Promise.all(deletePromises);

      // Add notification message to the chat
      await addDoc(collection(db, "messages"), {
        content: `🗑️ Task deleted: ${task.title}`,
        userId: user.uid,
        groupId: task.groupId,
        sentAt: new Date().toISOString(),
        isSystemMessage: true,
      });

      toast({
        title: "Success",
        description: "Task deleted successfully",
      });

      // Redirect to tasks page
      navigate("/tasks");
    } catch (err: any) {
      console.error("Error deleting task:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to delete task. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Check if user has already submitted
  const hasUserSubmitted = submissions.some(
    (submission) => submission.userId === user?.uid
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-bold mb-2">Loading Task Details</h1>
          <p className="text-gray-500">Please wait...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-bold mb-2 text-red-500">Error</h1>
          <p className="mb-4">{error}</p>
          <Button onClick={() => navigate("/tasks")}>
            Back to Tasks
          </Button>
        </div>
      </div>
    );
  }

  // Authentication required
  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">StudyConnect</h1>
          <p className="mb-4">Please log in to view task details</p>
          <Button onClick={() => navigate("/auth")}>
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-light">
      <div className="flex h-screen overflow-hidden">
        {/* Desktop Sidebar */}
        <Sidebar
          userName={user.displayName || user.email?.split("@")[0] || "User"}
          userEmail={user.email || ""}
          userAvatar={user.photoURL || null}
          activeItem="tasks"
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          {/* Top Header */}
          <header className="bg-white border-b border-gray-200 p-4 sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <button
                  className="text-neutral-dark hover:text-primary mr-3"
                  onClick={() => navigate("/tasks")}
                >
                  <i className="ri-arrow-left-line text-xl"></i>
                </button>
                <h1 className="text-xl font-semibold text-neutral-dark">Task Details</h1>
              </div>
              {isAdmin && (
                <Button variant="destructive" onClick={handleDeleteTask}>
                  Delete Task
                </Button>
              )}
            </div>
          </header>

          {/* Task Details */}
          <div className="flex-1 p-4">
            <div className="max-w-4xl mx-auto">
              {task && (
                <>
                  <Card className="mb-6">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-2xl">{task.title}</CardTitle>
                          <div className="flex items-center mt-2 space-x-2">
                            <Badge variant={task.type === "leetcode" ? "default" : task.type === "form" ? "outline" : "secondary"}>
                              {task.type.charAt(0).toUpperCase() + task.type.slice(1)}
                            </Badge>
                            <span className="text-sm text-gray-500">
                              Created {formatDate(task.createdAt)}
                            </span>
                          </div>
                        </div>
                        {task.resourceLink && (
                          <a
                            href={task.resourceLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center text-primary hover:underline"
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Resource
                          </a>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="whitespace-pre-wrap">{task.description}</p>
                    </CardContent>
                  </Card>

                  <Tabs defaultValue={hasUserSubmitted ? "submissions" : "submit"}>
                    <TabsList className="mb-4">
                      {!hasUserSubmitted && <TabsTrigger value="submit">Submit Solution</TabsTrigger>}
                      <TabsTrigger value="submissions">Submissions ({submissions.length})</TabsTrigger>
                    </TabsList>

                    {!hasUserSubmitted && (
                      <TabsContent value="submit">
                        <Card>
                          <CardHeader>
                            <CardTitle>Submit Your Solution</CardTitle>
                            {task.type === "leetcode" && userProfile?.leetCodeUsername && (
                              <CardDescription>
                                We can verify your LeetCode submission automatically.
                              </CardDescription>
                            )}
                          </CardHeader>
                          <CardContent>
                            {task.type === "leetcode" && userProfile?.leetCodeUsername && (
                              <div className="mb-6">
                                <div className="flex items-center justify-between mb-2">
                                  <Label>LeetCode Verification</Label>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={verifyLeetCodeSubmission}
                                    disabled={leetCodeVerification.status === "checking"}
                                  >
                                    {leetCodeVerification.status === "checking" ? "Checking..." : "Verify Submission"}
                                  </Button>
                                </div>
                                {leetCodeVerification.status !== "idle" && (
                                  <div className={`p-3 rounded-md mt-2 text-sm ${
                                    leetCodeVerification.status === "success" 
                                      ? "bg-green-50 text-green-700" 
                                      : leetCodeVerification.status === "error"
                                      ? "bg-red-50 text-red-700"
                                      : "bg-blue-50 text-blue-700"
                                  }`}>
                                    <div className="flex items-center">
                                      {leetCodeVerification.status === "success" ? (
                                        <Check className="h-4 w-4 mr-2" />
                                      ) : leetCodeVerification.status === "error" ? (
                                        <X className="h-4 w-4 mr-2" />
                                      ) : (
                                        <Clock className="h-4 w-4 mr-2" />
                                      )}
                                      {leetCodeVerification.message}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="submissionLink">Submission Link (Optional)</Label>
                                <Input
                                  id="submissionLink"
                                  name="submissionLink"
                                  value={submissionForm.submissionLink}
                                  onChange={handleInputChange}
                                  placeholder="https://"
                                />
                              </div>
                              <div>
                                <Label htmlFor="comments">Comments (Optional)</Label>
                                <Textarea
                                  id="comments"
                                  name="comments"
                                  value={submissionForm.comments}
                                  onChange={handleInputChange}
                                  placeholder="Add any comments about your solution..."
                                  rows={3}
                                />
                              </div>
                              <Button
                                className="w-full"
                                onClick={handleSubmitTask}
                                disabled={isSubmitting || (task.type === "leetcode" && leetCodeVerification.status === "checking")}
                              >
                                {isSubmitting ? "Submitting..." : "Submit Solution"}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </TabsContent>
                    )}

                    <TabsContent value="submissions">
                      <Card>
                        <CardHeader>
                          <CardTitle>Submissions</CardTitle>
                          <CardDescription>
                            {submissions.length} {submissions.length === 1 ? "student has" : "students have"} submitted this task
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {submissions.length > 0 ? (
                            <div className="space-y-4">
                              {submissions.map((submission) => (
                                <div
                                  key={submission.id}
                                  className="flex items-start p-4 border rounded-lg bg-white"
                                >
                                  <div className="flex-shrink-0 mr-3">
                                    <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white">
                                      {submission.user?.name ? submission.user.name.charAt(0).toUpperCase() : "U"}
                                    </div>
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex justify-between items-start mb-1">
                                      <h4 className="font-medium">
                                        {submission.user?.name || submission.user?.email?.split("@")[0] || "Unknown User"}
                                      </h4>
                                      <span className="text-xs text-gray-500">
                                        {formatDate(submission.submittedAt)}
                                      </span>
                                    </div>
                                    {submission.comments && (
                                      <p className="text-sm text-gray-700 mb-2">{submission.comments}</p>
                                    )}
                                    {submission.submissionLink && (
                                      <a
                                        href={submission.submissionLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-primary hover:underline flex items-center"
                                      >
                                        <ExternalLink className="h-3 w-3 mr-1" />
                                        View Submission
                                      </a>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8 text-gray-500">
                              <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                              <p>No submissions yet</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <MobileNav activeItem="tasks" />
    </div>
  );
}