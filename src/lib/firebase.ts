/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Helper to get environment variables safely across Node and Browser
const getEnvVar = (key: string) => {
  // Try Vite's import.meta.env first (for browser)
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      return import.meta.env[key];
    }
  } catch (e) {}
  
  // Try Node's process.env (for server)
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  
  return undefined;
};

// Firebase configuration with environment variable support for Vercel
const config = {
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY') || firebaseConfig.apiKey,
  authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN') || firebaseConfig.authDomain,
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID') || firebaseConfig.projectId,
  storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET') || firebaseConfig.storageBucket,
  messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID') || firebaseConfig.messagingSenderId,
  appId: getEnvVar('VITE_FIREBASE_APP_ID') || firebaseConfig.appId,
  measurementId: getEnvVar('VITE_FIREBASE_MEASUREMENT_ID') || firebaseConfig.measurementId,
};

const app = initializeApp(config);
const dbId = getEnvVar('VITE_FIREBASE_DATABASE_ID') || firebaseConfig.firestoreDatabaseId;
export const db = dbId ? getFirestore(app, dbId) : getFirestore(app);
export const auth = getAuth(app);
