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
      submitStats {
        acSubmissionNum {
          difficulty
          count
        }
      }
      submissionCalendar
      submitStats {
        totalSubmissionNum {
          difficulty
          count
        }
      }
    }
    question(titleSlug: $titleSlug) {
      questionId
      title
      titleSlug
      difficulty
      status
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
    
    // Get combined user and problem data
    const { data } = await leetcodeClient.query({
      query: GET_USER_PROBLEM_STATUS,
      variables: { username, titleSlug },
    });

    // Get recent submissions to check if this problem has been solved
    const { data: recentData } = await leetcodeClient.query({
      query: GET_RECENT_SUBMISSIONS,
      variables: { username, limit: 20 },
    });

    // Check if the problem appears in recent accepted submissions
    const recentSubmissions = recentData.recentSubmissionList || [];
    const problemSolved = recentSubmissions.some(
      (submission: any) => submission.titleSlug === titleSlug && submission.statusDisplay === "Accepted"
    );

    return {
      problem: data.question,
      user: data.matchedUser,
      solved: problemSolved,
      recentSubmissions: recentSubmissions
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
      return { verified: false, error: "Missing username or problem identifier" };
    }
    
    const result = await checkProblemStatus(username, problemTitleSlug);
    
    return {
      verified: result.solved,
      problem: result.problem,
      user: {
        username: result.user?.username,
        // Include any other needed user data
      },
      submissions: result.recentSubmissions?.filter(
        (s: any) => s.titleSlug === problemTitleSlug
      )
    };
  } catch (error: any) {
    console.error("Error verifying LeetCode completion:", error);
    return { 
      verified: false, 
      error: error.message || "Failed to verify completion" 
    };
  }
}
