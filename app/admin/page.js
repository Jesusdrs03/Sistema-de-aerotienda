'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listarPedidos, listarStock } from '@/lib/data';
import { sedeNombre } from '@/lib/config';
import { fmtFecha } from '@/lib/utils';
import { Badge, Cargando } from '@/components/ui';

export default function Inicio() {
  const [pedidos, setPedidos] = useState(null);
  const [stock, setStock] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    Promise.all([listarPedidos(300), listarStock()])
      .then(([p, s]) => { setPedidos(p); setStock(s); })
      .catch((e) => setErr(e.message));
  }, []);

  if (err) return <div className="alert error">{err}</div>;
  if (!pedidos) return <Cargando />;

  const c = (e) => pedidos.filter((p) => e.includes(p.estado)).length;
  const unidades = stock.reduce((a, s) => a + (s.cantidad || 0), 0);

  return (
    <>
      <div className="row between"><h1>Inicio</h1><Link className="btn" href="/admin/pedidos/nuevo">➕ Registrar pedido</Link></div>
      <div className="stats">
        <div className="stat"><b>{c(['en_transito'])}</b><span>En tránsito (por llegar)</span></div>
        <div className="stat"><b>{c(['recibido', 'recibido_incompleto', 'entregado_parcial'])}</b><span>Pendientes por entregar</span></div>
        <div className="stat"><b>{c(['recibido_incompleto'])}</b><span>Llegaron incompletos</span></div>
        <div className="stat"><b>{c(['entregado'])}</b><span>Entregados</span></div>
        <div className="stat"><b>{unidades}</b><span>Unidades en stock</span></div>
      </div>
      <div className="card">
        <h2>Últimos pedidos</h2>
        <div className="tablewrap">
          <table>
            <thead><tr><th>N° pedido</th><th>Alumno</th><th>Sede</th><th>Fecha</th><th>Estado</th></tr></thead>
            <tbody>
              {pedidos.slice(0, 12).map((p) => (
                <tr key={p.id}>
                  <td><Link href={`/admin/pedidos/${p.id}`}><b>{p.numero}</b></Link></td>
                  <td>{p.alumno?.nombre}<div className="muted">{p.alumno?.cedula}</div></td>
                  <td>{sedeNombre(p.sede)}</td>
                  <td>{fmtFecha(p.creadoEn)}</td>
                  <td><Badge estado={p.estado} /></td>
                </tr>
              ))}
              {!pedidos.length && <tr><td colSpan={5} className="muted">Aún no hay pedidos.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
