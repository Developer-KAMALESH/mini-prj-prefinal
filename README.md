# StudySync - Student Community Platform

StudySync is a comprehensive student community platform that combines social collaboration tools with engaging task management and communication features, focusing on interactive learning and group productivity.

## Features

- **Authentication System** - User registration and login with email/password or Google authentication
- **Group Management** - Create and join study groups with admin privileges
- **Group Chat** - Real-time messaging for group communications
- **Task Management** - Create, assign, and track various task types (general, Google Forms, LeetCode)
- **Leaderboard** - Competitive scoring system to track student progress
- **Flashcards** - Create and study with flashcard collections within your groups

## Local Development Setup

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Firebase account

### Firebase Setup

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Set up Firebase Authentication:
   - Enable Email/Password sign-in
   - (Optional) Enable Google sign-in
4. Set up Firestore Database:
   - Create a Firestore database
   - Set security rules to allow read/write

### Application Setup

For more detailed setup instructions, see [Local Setup Guide](docs/local-setup.md).

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure Firebase (choose one method):

   **Option 1: Run the configuration generator script:**
   ```bash
   node scripts/generate-firebase-config.js
   ```
   Follow the prompts to enter your Firebase project details.

   **Option 2: Configure manually:**
   - Open `firebase.config.local.js` in the root directory
   - Replace the placeholder values with your Firebase project configuration:
     ```javascript
     export default {
       apiKey: "YOUR_API_KEY",
       projectId: "YOUR_PROJECT_ID",
       appId: "YOUR_APP_ID",
       // Optional additional configurations
       authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
       storageBucket: "YOUR_PROJECT_ID.appspot.com",
       messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
       measurementId: "YOUR_MEASUREMENT_ID"
     };
     ```
   - You can find these values in your Firebase project settings > Project Overview > Add app > Web app configuration

4. Start the development server:
   ```bash
   npm run dev
   ```
   
5. Open your browser and navigate to `http://localhost:5000`

## Firebase Security Rules

For your Firestore database, you can use these basic security rules to get started:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

For more granular control, you can refine these rules for specific collections.

## Project Structure

- `/client` - Frontend React + TypeScript application
  - `/src/components` - UI components
  - `/src/hooks` - Custom React hooks
  - `/src/lib` - Utility functions and Firebase config
  - `/src/pages` - Application pages
- `/server` - Backend Express server
- `/shared` - Shared types and schemas

## Authentication Flows

- Email/Password Registration & Login
- Google Sign-in
- Password Reset

## License

This project is licensed under the MIT License.