/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
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
const configuredDbId = String(
  viteEnv.VITE_FIREBASE_DATABASE_ID || firebaseConfig.firestoreDatabaseId || '',
).trim();

export const firestoreDatabaseId = configuredDbId && configuredDbId !== '(default)'
  ? configuredDbId
  : '(default)';

export const defaultDb = getFirestore(app);
export const namedDb = firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firestoreDatabaseId)
  : null;

// This project’s data lives on the configured AI Studio database.
// "(default)" is not created here — opening it made admin/merchant
// listeners fail or look empty even when the named DB still had quota.
export let db = namedDb || defaultDb;
export const auth = getAuth(app);
export const storage = getStorage(app);

/** Only the configured database. Do not also attach a missing "(default)". */
export function getPanelFirestoreDbs(): Firestore[] {
  return [db];
}

export function firestoreDatabaseLabel(instance: Firestore): string {
  if (namedDb && instance === namedDb) return firestoreDatabaseId;
  return '(default)';
}

export function setPanelWriteDb(instance: Firestore) {
  db = instance;
}
