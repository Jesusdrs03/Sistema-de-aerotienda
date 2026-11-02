// Crea (o actualiza) un usuario administrador.
// Uso:
//   node scripts/crear-admin.mjs ./service-account.json correo@ejemplo.com Clave123 "Nombre Apellido" caracas-santa-monica
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const [, , saPath, email, password, nombre = '', sede = 'caracas-santa-monica'] = process.argv;
if (!saPath || !email || !password) {
  console.log('Uso: node scripts/crear-admin.mjs <service-account.json> <correo> <clave> ["Nombre"] [sede]');
  console.log('Sedes: barquisimeto | caracas-santa-monica');
  process.exit(1);
}

initializeApp({ credential: cert(JSON.parse(readFileSync(saPath, 'utf8'))) });
const auth = getAuth();
let user;
try {
  user = await auth.getUserByEmail(email);
  await auth.updateUser(user.uid, { password, displayName: nombre || undefined });
  console.log('Usuario existente actualizado:', user.uid);
} catch {
  user = await auth.createUser({ email, password, displayName: nombre || undefined });
  console.log('Usuario creado:', user.uid);
}
await getFirestore().doc(`admins/${user.uid}`).set({ email, nombre, sede, rol: 'admin', creadoEn: FieldValue.serverTimestamp() }, { merge: true });
console.log(`✅ ${email} ahora es administrador (sede: ${sede})`);
process.exit(0);
