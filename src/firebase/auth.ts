import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { auth } from './client'
import type { OwnerProfile } from '../types'

export function listenToAuthState(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback)
}

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  const result = await signInWithPopup(auth, provider)
  return result.user
}

export async function signOutCurrentUser(): Promise<void> {
  await signOut(auth)
}

export function getOwnerProfile(user: User): OwnerProfile {
  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
  }
}
