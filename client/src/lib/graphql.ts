import { ApolloClient, InMemoryCache, gql } from '@apollo/client';

// Create Apollo Client instance
export const leetcodeClient = new ApolloClient({
  uri: 'https://leetcode.com/graphql',
  cache: new InMemoryCache(),
});

// GraphQL query to get user profile and submission status
export const GET_USER_PROFILE = gql`
  query getUserProfile($username: String!) {
    matchedUser(username: $username) {
      username
      githubUrl
      twitterUrl
      submitStats: submitStatsGlobal {
        acSubmissionNum {
          difficulty
          count
          submissions
        }
      }
    }
  }
`;

// Query to get problem details
export const GET_PROBLEM_STATUS = gql`
  query getProblemStatus($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      questionId
      title
      titleSlug
      difficulty
      status
      stats
      isPaidOnly
    }
  }
`;

// Query to check a specific user's submissions for a problem
export const GET_USER_PROBLEM_STATUS = gql`
  query userProblemStatus($username: String!, $titleSlug: String!) {
    matchedUser(username: $username) {
      username
      submitStats: submitStatsGlobal {
        acSubmissionNum {
          difficulty
          count
          submissions
        }
      }
      submissionCalendar
    }
    question(titleSlug: $titleSlug) {
      questionId
      title
      titleSlug
      difficulty
      status
      translatedTitle
      isPaidOnly
    }
  }
`;

// Query to get recent submissions for a user
export const GET_RECENT_SUBMISSIONS = gql`
  query recentSubmissions($username: String!, $limit: Int!) {
    recentSubmissionList(username: $username, limit: $limit) {
      id
      title
      titleSlug
      timestamp
      statusDisplay
      lang
    }
  }
`;

// Function to fetch a user's LeetCode submissions
export async function fetchUserSubmissions(username: string) {
  try {
    const { data } = await leetcodeClient.query({
      query: GET_USER_PROFILE,
      variables: { username },
    });
    return data.matchedUser;
  } catch (error) {
    console.error('Error fetching LeetCode user data:', error);
    throw error;
  }
}

// Function to check if a user has solved a specific problem
export async function checkProblemStatus(username: string, titleSlug: string) {
  try {
    if (!username || !titleSlug) {
      throw new Error("Username and problem titleSlug are required");
    }
    
    console.log(`Checking LeetCode problem status for user ${username} and problem ${titleSlug}`);
    
    // Get combined user and problem data - this fetches the problem status
    const { data } = await leetcodeClient.query({
      query: GET_USER_PROBLEM_STATUS,
      variables: { username, titleSlug },
      fetchPolicy: 'network-only', // Don't use cache for verification
    });

    // Get recent submissions to verify this problem has been solved recently
    const { data: recentData } = await leetcodeClient.query({
      query: GET_RECENT_SUBMISSIONS,
      variables: { username, limit: 20 },
      fetchPolicy: 'network-only', // Don't use cache for verification
    });

    // Check if the problem exists in LeetCode
    if (!data.question) {
      console.error(`Problem with titleSlug "${titleSlug}" not found on LeetCode`);
      return {
        problem: null,
        user: data.matchedUser,
        solved: false,
        error: `Problem "${titleSlug}" not found on LeetCode`,
        recentSubmissions: []
      };
    }

    // Check if problem status from LeetCode indicates it's solved
    // LeetCode statuses: null (not attempted), "ac" (accepted/solved), 
    // "notac" (attempted but not solved)
    const problemStatus = data.question?.status;
    console.log("LeetCode problem status:", problemStatus);
    
    // Check if the problem appears in recent accepted submissions
    const recentSubmissions = recentData.recentSubmissionList || [];
    console.log("Recent submissions count:", recentSubmissions.length);
    
    // Find submissions for this specific problem
    const relevantSubmissions = recentSubmissions.filter(
      (submission: any) => submission.titleSlug === titleSlug
    );
    
    console.log(`Found ${relevantSubmissions.length} submissions for this problem`);
    
    // At least one "Accepted" submission is needed
    const hasAcceptedSubmission = relevantSubmissions.some(
      (submission: any) => submission.statusDisplay === "Accepted"
    );
    
    // NEW APPROACH: 
    // 1. If problem status is "ac" = user has solved it at some point
    // 2. If there's a recent "Accepted" submission, user has solved it recently
    
    // For task verification in StudySync, we'll consider problem solved if:
    // - Problem status is "ac" (user has solved it in the past) AND
    // - There's a recent "Accepted" submission (within last 20 submissions)
    const problemSolved = (
      problemStatus === "ac" && 
      hasAcceptedSubmission
    );

    console.log("Problem solved status:", problemSolved);
    console.log("Problem has 'ac' status:", problemStatus === "ac");
    console.log("Has recent accepted submission:", hasAcceptedSubmission);

    return {
      problem: data.question,
      user: data.matchedUser,
      solved: problemSolved,
      recentSubmissions: relevantSubmissions
    };
  } catch (error) {
    console.error('Error checking problem status:', error);
    throw error;
  }
}

// Function to verify LeetCode task completion
export async function verifyLeetCodeCompletion(username: string, problemTitleSlug: string) {
  try {
    if (!username || !problemTitleSlug) {
      return { 
        verified: false, 
        error: "Missing username or problem identifier" 
      };
    }
    
    console.log(`Verifying LeetCode completion for user ${username} and problem ${problemTitleSlug}`);
    
    const result = await checkProblemStatus(username, problemTitleSlug);
    
    // If result has an error field, there was a problem with verification
    if ('error' in result) {
      return { 
        verified: false, 
        error: result.error,
        problem: null
      };
    }
    
    // Format the response data
    const verificationResult = {
      verified: result.solved,
      problem: {
        id: result.problem?.questionId,
        title: result.problem?.title,
        titleSlug: result.problem?.titleSlug,
        difficulty: result.problem?.difficulty,
        isPaidOnly: result.problem?.isPaidOnly
      },
      user: {
        username: result.user?.username
      },
      // Include only the successful submissions
      submissions: result.recentSubmissions
        ?.filter((s: any) => s.statusDisplay === "Accepted")
        .map((s: any) => ({
          id: s.id,
          title: s.title,
          timestamp: s.timestamp,
          language: s.lang
        }))
    };
    
    console.log("LeetCode verification result:", 
      verificationResult.verified ? "VERIFIED ✓" : "NOT VERIFIED ✗");
    
    return verificationResult;
  } catch (error: any) {
    console.error("Error verifying LeetCode completion:", error);
    return { 
      verified: false, 
      error: error.message || "Failed to verify completion" 
    };
  }
}
