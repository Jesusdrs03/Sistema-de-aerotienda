'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { getAuthClient, getDb } from '@/lib/firebase';
import { APP_NAME, sedeNombre } from '@/lib/config';
import { AdminContext } from '@/components/AdminContext';

const NAV = [
  ['/admin', '📊 Inicio'],
  ['/admin/pedidos/nuevo', '➕ Nuevo pedido'],
  ['/admin/pedidos', '📦 Pedidos'],
  ['/admin/stock', '🏷️ Stock y reasignación'],
  ['/admin/articulos', '👕 Artículos'],
  ['/admin/reportes', '📑 Reportes'],
];

export default function AdminLayout({ children }) {
  const router = useRouter();
  const path = usePathname();
  const [st, setSt] = useState({ loading: true, user: null, admin: null });

  useEffect(() => onAuthStateChanged(getAuthClient(), async (u) => {
    if (!u) { router.replace('/login'); return; }
    let admin = null;
    try { const a = await getDoc(doc(getDb(), 'admins', u.uid)); admin = a.exists() ? a.data() : null; } catch {}
    setSt({ loading: false, user: u, admin });
  }), [router]);

  if (st.loading) return <p style={{ padding: 30 }} className="muted">Cargando…</p>;
  if (!st.admin) {
    return (
      <div style={{ maxWidth: 480, margin: '80px auto' }} className="card">
        <h2>Sin acceso</h2>
        <p>El usuario <b>{st.user?.email}</b> no está registrado como administrador.</p>
        <p className="muted">Pide que lo agreguen con el script <code>npm run crear-admin</code> o creando el documento <code>admins/{st.user?.uid}</code> en Firestore.</p>
        <button className="btn sec" onClick={() => signOut(getAuthClient())}>Cerrar sesión</button>
      </div>
    );
  }

  const activo = (href) => (href === '/admin' ? path === '/admin' : path === href || (href === '/admin/pedidos' && path.startsWith('/admin/pedidos/') && path !== '/admin/pedidos/nuevo'));

  return (
    <AdminContext.Provider value={st}>
      <div className="shell">
        <nav className="side">
          <div className="brand">✈️ {APP_NAME}<small>Gestión de pedidos y stock</small></div>
          {NAV.map(([h, t]) => <Link key={h} href={h} className={activo(h) ? 'on' : ''}>{t}</Link>)}
          <div className="user">
            {st.admin.nombre || st.user.email}<br />
            {st.admin.sede && <span>{sedeNombre(st.admin.sede)}<br /></span>}
            <a href="#" style={{ padding: 0, display: 'inline' }} onClick={(e) => { e.preventDefault(); signOut(getAuthClient()); }}>Cerrar sesión</a>
          </div>
        </nav>
        <main className="main">{children}</main>
      </div>
    </AdminContext.Provider>
  );
}
