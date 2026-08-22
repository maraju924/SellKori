/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
// `with { type: 'json' }` is required for plain Node ESM (Vercel functions);
// Vite/tsx also support it.
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

// Firebase configuration with environment variable support for Vercel
const viteEnv = (import.meta.env || {}) as Record<string, string | undefined>;
const firebaseConfigData = {
  apiKey: viteEnv.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
  authDomain: viteEnv.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  projectId: viteEnv.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  storageBucket: viteEnv.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  messagingSenderId: viteEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
  appId: viteEnv.VITE_FIREBASE_APP_ID || firebaseConfig.appId,
  measurementId: viteEnv.VITE_FIREBASE_MEASUREMENT_ID || firebaseConfig.measurementId,
};

// Reuse the default app when it already exists (e.g. the API server
// initializes Firebase too); initializeApp throws on duplicate [DEFAULT].
const app = getApps().length ? getApp() : initializeApp(firebaseConfigData);
const dbId = viteEnv.VITE_FIREBASE_DATABASE_ID || firebaseConfig.firestoreDatabaseId;

export const db = (dbId && dbId !== "") ? getFirestore(app, dbId) : getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
