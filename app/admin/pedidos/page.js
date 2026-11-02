'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { listarPedidos, buscarPedidoPorNumero } from '@/lib/data';
import { SEDES, ESTADOS, sedeNombre } from '@/lib/config';
import { fmtFecha } from '@/lib/utils';
import { Alerta, Badge, Cargando } from '@/components/ui';

export default function Pedidos() {
  const router = useRouter();
  const [lista, setLista] = useState(null);
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');
  const [sede, setSede] = useState('');
  const [msg, setMsg] = useState(null);

  useEffect(() => { listarPedidos(1000).then(setLista).catch((e) => setMsg({ type: 'error', text: e.message })); }, []);

  const filtrados = useMemo(() => (lista || []).filter((p) => {
    if (estado && p.estado !== estado) return false;
    if (sede && p.sede !== sede) return false;
    if (!q) return true;
    const t = `${p.numero} ${p.alumno?.nombre} ${p.alumno?.cedula} ${p.alumno?.telefono}`.toLowerCase();
    return t.includes(q.toLowerCase());
  }), [lista, q, estado, sede]);

  async function irNumero(e) {
    e.preventDefault();
    if (!q.trim()) return;
    const p = await buscarPedidoPorNumero(q);
    if (p) router.push(`/admin/pedidos/${p.id}`);
    else if (!filtrados.length) setMsg({ type: 'error', text: `No se encontró el pedido ${q}` });
  }

  return (
    <>
      <div className="row between"><h1>Pedidos</h1><Link className="btn" href="/admin/pedidos/nuevo">➕ Nuevo pedido</Link></div>
      <Alerta msg={msg} onClose={() => setMsg(null)} />
      <form className="card row" onSubmit={irNumero}>
        <input style={{ flex: 2, minWidth: 220 }} placeholder="Buscar por N° de pedido, nombre, cédula o teléfono (Enter abre el pedido)" value={q} onChange={(e) => setQ(e.target.value)} />
        <select style={{ flex: 1, minWidth: 150 }} value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select style={{ flex: 1, minWidth: 150 }} value={sede} onChange={(e) => setSede(e.target.value)}>
          <option value="">Todas las sedes</option>
          {SEDES.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
      </form>
      <div className="card">
        {!lista ? <Cargando /> : (
          <div className="tablewrap">
            <table>
              <thead><tr><th>N° pedido</th><th>Alumno</th><th>Artículos</th><th>Origen → Sede</th><th>Fecha</th><th>Estado</th></tr></thead>
              <tbody>
                {filtrados.map((p) => (
                  <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/admin/pedidos/${p.id}`)}>
                    <td><b>{p.numero}</b></td>
                    <td>{p.alumno?.nombre}<div className="muted">C.I. {p.alumno?.cedula}</div></td>
                    <td className="muted">{(p.items || []).filter((i) => i.cantidad > 0).map((i) => `${i.nombre} (${i.talla}) x${i.cantidad}`).join(', ')}</td>
                    <td>{sedeNombre(p.origen)} → {sedeNombre(p.sede)}</td>
                    <td>{fmtFecha(p.creadoEn, false)}</td>
                    <td><Badge estado={p.estado} /></td>
                  </tr>
                ))}
                {!filtrados.length && <tr><td colSpan={6} className="muted">Sin resultados.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
