'use client';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Inicialización perezosa: evita errores durante el build en el servidor
const usarEmulador = process.env.NEXT_PUBLIC_USE_EMULATOR === 'true';

function app() {
  if (getApps().length) return getApps()[0];
  const a = initializeApp(config);
  if (usarEmulador) {
    connectAuthEmulator(getAuth(a), 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(getFirestore(a), '127.0.0.1', 8080);
  }
  return a;
}
export const getAuthClient = () => getAuth(app());
export const getDb = () => getFirestore(app());
