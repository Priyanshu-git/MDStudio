import { initializeApp } from 'firebase/app'
import { getAnalytics } from 'firebase/analytics'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyARzbJlw-jQrhoAgAfUvqzaK-a_KaXW-bI',
  authDomain: 'md-studio-7c9d6.firebaseapp.com',
  projectId: 'md-studio-7c9d6',
  storageBucket: 'md-studio-7c9d6.firebasestorage.app',
  messagingSenderId: '722146588921',
  appId: '1:722146588921:web:b3ecbf0729467111e48a28',
  measurementId: 'G-LFKQTJMHC1',
}

export const app = initializeApp(firebaseConfig)
export const firestore = getFirestore(app)

function initializeAnalyticsSafely() {
  if (typeof window === 'undefined' || import.meta.env.MODE === 'test') {
    return null
  }
  try {
    return getAnalytics(app)
  } catch {
    return null
  }
}

export const analytics = initializeAnalyticsSafely()
