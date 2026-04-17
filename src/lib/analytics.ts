import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const SESSION_ID = Math.random().toString(36).substring(2, 15);

export async function trackEvent(businessId: string, eventName: string, properties: Record<string, any> = {}, ownerId?: string) {
  try {
    await addDoc(collection(db, 'analytics'), {
      businessId,
      businessOwnerId: ownerId || '',
      eventName,
      properties,
      timestamp: serverTimestamp(),
      sessionId: SESSION_ID
    });
  } catch (err) {
    console.error('Analytics Error:', err);
  }
}
