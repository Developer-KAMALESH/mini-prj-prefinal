# Local Setup Guide for StudySync

This guide will help you set up StudySync for local development.

## Prerequisites

1. Node.js (v14 or higher)
2. npm or yarn
3. A Firebase account

## Firebase Setup

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use an existing one)
3. Set up Firebase Authentication:
   - Go to the "Authentication" section in the Firebase console
   - Enable Email/Password authentication method
   - (Optional) Enable Google authentication for Google sign-in

4. Create a Firestore database:
   - Go to the "Firestore Database" section
   - Click "Create database"
   - Choose "Start in test mode" for development (you can update security rules later)

5. Get your Firebase configuration:
   - Go to Project settings (gear icon in the top-left sidebar)
   - Scroll down to "Your apps" section
   - If you haven't added a web app yet, click the web platform icon (`</>`)
   - Register your app with a name (e.g., "StudySync Web")
   - Copy the Firebase configuration object (it contains apiKey, authDomain, projectId, etc.)

## Application Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Firebase:
   - Open `firebase.config.local.js` in the root directory
   - Replace the placeholder values with your Firebase project configuration:
     ```javascript
     export default {
       apiKey: "YOUR_API_KEY",
       projectId: "YOUR_PROJECT_ID",
       appId: "YOUR_APP_ID",
       authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
       storageBucket: "YOUR_PROJECT_ID.appspot.com",
       messagingSenderId: "YOUR_MESSAGING_SENDER_ID", // Optional
       measurementId: "YOUR_MEASUREMENT_ID" // Optional
     };
     ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:5000`

## Firestore Data Structure

StudySync uses the following collections in Firestore:

- `users` - User profiles and information
- `groups` - Study groups
- `group_members` - Mapping between users and groups, including admin status
- `messages` - Chat messages within groups
- `tasks` - Tasks created within groups
- `task_submissions` - User submissions for tasks
- `flashcard_collections` - Collections of flashcards
- `flashcards` - Individual flashcards within collections

## Firebase Security Rules

For development, you can use these basic security rules:

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

For production, you should implement more granular security rules based on your application's needs.

## Common Issues and Solutions

### Authentication Domain Issues

If you encounter errors when signing in with Google, make sure:

1. Your domain is added to the authorized domains list in Firebase Authentication settings
2. For local development, `localhost` should be in the authorized domains list

### Firestore Permission Errors

If you encounter permission errors when reading/writing to Firestore:

1. Check your Firebase security rules
2. Ensure the user is properly authenticated
3. Verify that your Firebase project ID and API key are correct

## Additional Configuration

### Environment Variables

For production environments, you can use environment variables instead of the local config file:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID` (optional)
- `VITE_FIREBASE_MEASUREMENT_ID` (optional)

## Contributing

If you'd like to contribute to StudySync, please follow these steps:

1. Fork the repository
2. Create a new branch for your feature
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License.