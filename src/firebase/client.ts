import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const requiredFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

for (const [key, value] of Object.entries(requiredFirebaseConfig)) {
  if (!value) {
    throw new Error(`Missing Firebase environment variable for ${key}`)
  }
}

const firebaseConfig = {
  ...requiredFirebaseConfig,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

export const app = initializeApp(firebaseConfig)
export const firestore = getFirestore(app)
export const auth = getAuth(app)

export async function initializeAnalyticsSafely() {
  if (typeof window === 'undefined' || import.meta.env.MODE === 'test') {
    return null
  }
  try {
    const { getAnalytics } = await import('firebase/analytics')
    return getAnalytics(app)
  } catch {
    return null
  }
}
