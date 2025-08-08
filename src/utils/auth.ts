import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, User } from 'firebase/auth';

// TODO: Replace with your Firebase project settings
// Firebase config (provided)
const firebaseConfig = {
  apiKey: 'AIzaSyAumhHs3Iti3JeQspLEiChe59zNsLkbZcE',
  authDomain: 'accounting-dde26.firebaseapp.com',
  projectId: 'accounting-dde26',
  appId: '1:863363943316:web:b080b135c282275c28dd81',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const ALLOWED_EMAILS = new Set([
  'mushahidyaseen56@gmail.com',
  'rizwanelahi481@gmail.com',
]);

export const signInWithGoogle = async (): Promise<User | null> => {
  const result = await signInWithPopup(auth, provider);
  const user = result.user;
  if (!user.email || !ALLOWED_EMAILS.has(user.email.toLowerCase())) {
    await signOut(auth);
    throw new Error('Access denied: your account is not allowed.');
  }
  return user;
};

export const observeAuth = (cb: (user: User | null) => void) => onAuthStateChanged(auth, cb);
export const logout = () => signOut(auth);


