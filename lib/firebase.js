'use client';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

// Datos públicos de la app web (no son secretos). Se pueden sobrescribir con variables de entorno.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyCJPS5oFt8EuVFneUoA9ywQ3u63GvyC0D8',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'aerotienda-c4752.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'aerotienda-c4752',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'aerotienda-c4752.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '586976422787',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:586976422787:web:d7e31f68aebfb8616c24b6',
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
