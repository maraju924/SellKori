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
    const meta = import.meta as any;
    if (meta && meta.env && meta.env[key]) {
      return meta.env[key];
    }
  } catch (e) {}
  
  // Try Node's process.env (for server)
  try {
    const proc = (typeof process !== 'undefined') ? process as any : null;
    if (proc && proc.env && proc.env[key]) {
      return proc.env[key];
    }
  } catch (e) {}
  
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
