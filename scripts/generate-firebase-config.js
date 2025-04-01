#!/usr/bin/env node

/**
 * This script helps generate a firebase.config.local.js file
 * Run with: node scripts/generate-firebase-config.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const CONFIG_PATH = path.join(__dirname, '..', 'firebase.config.local.js');

console.log('StudySync Firebase Configuration Generator');
console.log('----------------------------------------');
console.log('This script will help you create a local Firebase configuration file.');
console.log('You can find these values in your Firebase project settings.');
console.log('');

// Prompt for configuration values
const questions = [
  { key: 'apiKey', message: 'Enter your Firebase API Key:', required: true },
  { key: 'projectId', message: 'Enter your Firebase Project ID:', required: true },
  { key: 'appId', message: 'Enter your Firebase App ID:', required: true },
  { key: 'authDomain', message: 'Enter your Firebase Auth Domain (optional, press Enter to skip):', required: false },
  { key: 'storageBucket', message: 'Enter your Firebase Storage Bucket (optional, press Enter to skip):', required: false },
  { key: 'messagingSenderId', message: 'Enter your Firebase Messaging Sender ID (optional, press Enter to skip):', required: false },
  { key: 'measurementId', message: 'Enter your Firebase Measurement ID (optional, press Enter to skip):', required: false }
];

const config = {};

// Process questions recursively
function askQuestion(index) {
  if (index >= questions.length) {
    generateConfigFile();
    return;
  }

  const question = questions[index];
  rl.question(`${question.message} `, (answer) => {
    if (question.required && !answer.trim()) {
      console.log(`This field is required. Please provide a value.`);
      askQuestion(index); // Ask the same question again
    } else {
      if (answer.trim()) {
        config[question.key] = answer.trim();
      }
      askQuestion(index + 1);
    }
  });
}

// Generate the configuration file
function generateConfigFile() {
  // Set default values for optional fields
  if (!config.authDomain && config.projectId) {
    config.authDomain = `${config.projectId}.firebaseapp.com`;
  }
  
  if (!config.storageBucket && config.projectId) {
    config.storageBucket = `${config.projectId}.appspot.com`;
  }

  const configContent = `// Firebase configuration for local development
// Generated on ${new Date().toISOString()}
// DO NOT COMMIT THIS FILE TO VERSION CONTROL

export default {
  apiKey: "${config.apiKey}",
  projectId: "${config.projectId}",
  appId: "${config.appId}",
  authDomain: "${config.authDomain || ''}",
  storageBucket: "${config.storageBucket || ''}",
  messagingSenderId: "${config.messagingSenderId || ''}",
  measurementId: "${config.measurementId || ''}"
};`;

  try {
    fs.writeFileSync(CONFIG_PATH, configContent);
    console.log('');
    console.log(`Firebase configuration saved to: ${CONFIG_PATH}`);
    console.log('');
    console.log('You can now start the application with: npm run dev');
  } catch (error) {
    console.error('Error writing configuration file:', error);
  }

  rl.close();
}

// Check if config file already exists
if (fs.existsSync(CONFIG_PATH)) {
  rl.question('A configuration file already exists. Do you want to override it? (y/n): ', (answer) => {
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      askQuestion(0);
    } else {
      console.log('Operation cancelled. Existing configuration file was not modified.');
      rl.close();
    }
  });
} else {
  askQuestion(0);
}