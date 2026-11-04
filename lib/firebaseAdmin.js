import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Credenciales del servidor. Opción recomendada: FIREBASE_SERVICE_ACCOUNT con el contenido
// COMPLETO del archivo .json de la cuenta de servicio. Alternativa: las 3 variables separadas.
function credenciales() {
  const json = (process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();
  if (json) {
    const sa = JSON.parse(json.startsWith('{') ? json : Buffer.from(json, 'base64').toString('utf8'));
    return cert(sa);
  }
  const key = (process.env.FIREBASE_PRIVATE_KEY || '').trim().replace(/^"|"$/g, '').replace(/\\n/g, '\n');
  return cert({
    projectId: process.env.FIREBASE_PROJECT_ID || 'aerotienda-c4752',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: key,
  });
}

function app() {
  if (getApps().length) return getApps()[0];
  if (process.env.FIRESTORE_EMULATOR_HOST) return initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'demo-aerotienda' });
  return initializeApp({ credential: credenciales() });
}
export const adminDb = () => getFirestore(app());
export const adminAuth = () => getAuth(app());
