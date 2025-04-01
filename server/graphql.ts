// Simple GraphQL schema and resolvers for LeetCode task verification

// GraphQL type definitions
export const typeDefs = `
  type Query {
    userSubmissions(username: String!): UserSubmissions
    problemStatus(username: String!, titleSlug: String!): ProblemStatus
  }

  type UserSubmissions {
    username: String
    totalSolved: Int
    easySolved: Int
    mediumSolved: Int
    hardSolved: Int
  }

  type ProblemStatus {
    problemId: String
    title: String
    difficulty: String
    solved: Boolean
  }
`;

// GraphQL resolvers
export const resolvers = {
  Query: {
    userSubmissions: async (_: any, { username }: { username: string }) => {
      try {
        // This would be replaced with actual LeetCode API calls
        // For now, returning mock data for development
        return {
          username,
          totalSolved: 0,
          easySolved: 0,
          mediumSolved: 0,
          hardSolved: 0
        };
      } catch (error) {
        console.error('Error fetching user submissions:', error);
        throw new Error('Failed to fetch user submissions');
      }
    },
    problemStatus: async (_: any, { username, titleSlug }: { username: string, titleSlug: string }) => {
      try {
        // This would be replaced with actual LeetCode API calls
        // For now, returning mock data for development
        return {
          problemId: "mock-id",
          title: titleSlug,
          difficulty: "Medium",
          solved: false
        };
      } catch (error) {
        console.error('Error checking problem status:', error);
        throw new Error('Failed to check problem status');
      }
    }
  }
};