'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { getAuthClient } from '@/lib/firebase';
import { APP_NAME } from '@/lib/config';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [cargando, setCargando] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setCargando(true); setError('');
    try {
      await signInWithEmailAndPassword(getAuthClient(), email.trim(), clave);
      router.replace('/admin');
    } catch {
      setError('Correo o contraseña incorrectos');
      setCargando(false);
    }
  }

  async function recuperar() {
    if (!email) return setError('Escribe tu correo primero');
    try { await sendPasswordResetEmail(getAuthClient(), email.trim()); setInfo('Te enviamos un correo para restablecer la contraseña.'); }
    catch { setError('No se pudo enviar el correo'); }
  }

  return (
    <div style={{ maxWidth: 380, margin: '80px auto', padding: 14 }}>
      <div className="card">
        <h1 style={{ textAlign: 'center' }}>✈️ {APP_NAME}</h1>
        <p className="muted" style={{ textAlign: 'center', marginTop: -8 }}>Panel de administración</p>
        {error && <div className="alert error">{error}</div>}
        {info && <div className="alert ok">{info}</div>}
        <form onSubmit={entrar}>
          <label>Correo</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <div style={{ height: 10 }} />
          <label>Contraseña</label>
          <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} required />
          <div style={{ height: 16 }} />
          <button className="btn" style={{ width: '100%', justifyContent: 'center' }} disabled={cargando}>{cargando ? 'Entrando…' : 'Entrar'}</button>
        </form>
        <p style={{ textAlign: 'center', marginBottom: 0 }}><a href="#" onClick={(e) => { e.preventDefault(); recuperar(); }} className="muted">¿Olvidaste tu contraseña?</a></p>
      </div>
      <p style={{ textAlign: 'center' }}><a href="/" className="muted">← Consulta de pedidos</a></p>
    </div>
  );
}
