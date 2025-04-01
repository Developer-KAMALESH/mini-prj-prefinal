# Firestore Security Rules Guide

To resolve the permission errors, you need to update your Firestore security rules in the Firebase Console. Follow these steps:

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. In the left navigation menu, click on "Firestore Database"
4. Navigate to the "Rules" tab
5. Replace the existing rules with the following:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read and write access to all users for now (while in development)
    match /{document=**} {
      allow read, write: if true;
    }
    
    // Later, you can replace with these more secure rules:
    // match /users/{userId} {
    //   allow read: if request.auth != null;
    //   allow write: if request.auth != null && request.auth.uid == userId;
    // }
    
    // match /groups/{groupId} {
    //   allow read: if request.auth != null;
    //   allow create: if request.auth != null;
    //   allow update, delete: if request.auth != null && 
    //     exists(/databases/$(database)/documents/group_members/$(request.auth.uid)_$(groupId)) &&
    //     get(/databases/$(database)/documents/group_members/$(request.auth.uid)_$(groupId)).data.role == "admin";
    // }
    
    // match /group_members/{membershipId} {
    //   allow read: if request.auth != null;
    //   allow write: if request.auth != null;
    // }
    
    // match /messages/{messageId} {
    //   allow read: if request.auth != null;
    //   allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
    //   allow update, delete: if request.auth != null && resource.data.userId == request.auth.uid;
    // }
  }
}
```

6. Click "Publish" to save the rules

> **IMPORTANT**: The rules above allow full read/write access to your database for development purposes. For production, you should implement more secure rules (like the commented ones).

Once you've updated these rules, the permission errors should be resolved and you'll be able to create and fetch groups.