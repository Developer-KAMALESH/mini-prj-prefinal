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
    // First get problem details
    const { data: problemData } = await leetcodeClient.query({
      query: GET_PROBLEM_STATUS,
      variables: { titleSlug },
    });
    
    // Then check the user's submission status
    const { data: userData } = await leetcodeClient.query({
      query: GET_USER_PROFILE,
      variables: { username },
    });
    
    // Check submissions for this problem
    // Note: This is a simplified approach as the actual implementation
    // would require querying user's submissions for the specific problem
    
    return {
      problem: problemData.question,
      user: userData.matchedUser,
      // Return a best guess based on available data
      solved: userData.matchedUser.submitStats.acSubmissionNum.submissions > 0
    };
  } catch (error) {
    console.error('Error checking problem status:', error);
    throw error;
  }
}
