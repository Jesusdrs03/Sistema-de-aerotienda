'use client';
import { useEffect, useMemo, useState } from 'react';
import { listarMovimientos, listarPedidosRango, listarStock } from '@/lib/data';
import { SEDES, ESTADOS, TIPOS_MOV, sedeNombre, APP_NAME } from '@/lib/config';
import { fmtFecha, descargarCSV, tallaTxt } from '@/lib/utils';
import { Alerta, Cargando } from '@/components/ui';

const hoy = () => new Date().toISOString().slice(0, 10);
const haceDias = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

const colMov = [
  { h: 'Fecha', v: (m) => fmtFecha(m.fecha) },
  { h: 'Sede', v: (m) => sedeNombre(m.sede) },
  { h: 'N° pedido', v: (m) => m.pedidoNumero || '' },
  { h: 'Alumno', v: (m) => m.alumnoNombre || '' },
  { h: 'Cédula', v: (m) => m.alumnoCedula || '' },
  { h: 'Artículo', v: (m) => m.articuloNombre },
  { h: 'Talla', v: (m) => m.talla },
  { h: 'Cantidad', v: (m) => m.cantidad },
  { h: 'Motivo', v: (m) => m.motivo || '' },
  { h: 'Detalle', v: (m) => m.detalle || '' },
  { h: 'Usuario', v: (m) => m.usuario || '' },
];

const TABS = {
  stock: {
    t: 'Stock actual',
    cols: [
      { h: 'Sede', v: (s) => sedeNombre(s.sede) },
      { h: 'Artículo', v: (s) => s.nombre },
      { h: 'Talla', v: (s) => s.talla },
      { h: 'Cantidad', v: (s) => s.cantidad },
      { h: 'Actualizado', v: (s) => fmtFecha(s.actualizadoEn) },
    ],
  },
  entregas: { t: 'Entregados', cols: colMov, tipo: ['entrega'] },
  reasignaciones: { t: 'Reasignados', cols: colMov, tipo: ['reasignacion'] },
  cambios: { t: 'Cambios', cols: [...colMov.slice(0, 7), { h: 'Cambiado por', v: (m) => `${m.nuevoArticuloNombre || ''} (${m.nuevaTalla || ''})` }, ...colMov.slice(7)], tipo: ['cambio'] },
  devoluciones: { t: 'Devoluciones a stock', cols: colMov, tipo: ['devolucion'] },
  ingresos: { t: 'Ingresos y ajustes', cols: [{ h: 'Tipo', v: (m) => TIPOS_MOV[m.tipo] }, ...colMov], tipo: ['ingreso', 'ajuste'] },
  pedidos: {
    t: 'Pedidos',
    cols: [
      { h: 'N° pedido', v: (p) => p.numero },
      { h: 'Fecha', v: (p) => fmtFecha(p.creadoEn) },
      { h: 'Origen', v: (p) => sedeNombre(p.origen) },
      { h: 'Sede', v: (p) => sedeNombre(p.sede) },
      { h: 'Alumno', v: (p) => p.alumno?.nombre },
      { h: 'Cédula', v: (p) => p.alumno?.cedula },
      { h: 'Teléfono', v: (p) => p.alumno?.telefono },
      { h: 'Correo', v: (p) => p.alumno?.email },
      { h: 'Curso', v: (p) => p.alumno?.curso },
      { h: 'Artículos', v: (p) => (p.items || []).filter((i) => i.cantidad > 0).map((i) => `${i.nombre} (${tallaTxt(i.talla)}) x${i.cantidad}`).join(', ') },
      { h: 'Estado', v: (p) => ESTADOS[p.estado]?.label || p.estado },
      { h: 'Llegó', v: (p) => fmtFecha(p.recibidoEn) },
    ],
  },
  faltantes: {
    t: 'Pendientes / faltantes',
    cols: [
      { h: 'N° pedido', v: (r) => r.p.numero },
      { h: 'Alumno', v: (r) => r.p.alumno?.nombre },
      { h: 'Teléfono', v: (r) => r.p.alumno?.telefono },
      { h: 'Sede', v: (r) => sedeNombre(r.p.sede) },
      { h: 'Artículo', v: (r) => r.i.nombre },
      { h: 'Talla', v: (r) => tallaTxt(r.i.talla) },
      { h: 'Pedido', v: (r) => r.i.cantidad },
      { h: 'Llegó', v: (r) => (r.p.recibidoEn ? r.i.recibido || 0 : 'No ha llegado') },
      { h: 'Entregado', v: (r) => r.i.entregado || 0 },
      { h: 'Pendiente', v: (r) => r.i.cantidad - (r.i.entregado || 0) },
    ],
  },
};

export default function Reportes() {
  const [desde, setDesde] = useState(haceDias(30));
  const [hasta, setHasta] = useState(hoy());
  const [sede, setSede] = useState('');
  const [tab, setTab] = useState('stock');
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState(null);

  async function cargar() {
    setData(null);
    try {
      const d1 = new Date(desde + 'T00:00:00');
      const d2 = new Date(hasta + 'T23:59:59');
      const [movs, pedidos, stock] = await Promise.all([listarMovimientos(d1, d2), listarPedidosRango(d1, d2), listarStock()]);
      setData({ movs, pedidos, stock });
    } catch (e) { setMsg({ type: 'error', text: e.message }); setData({ movs: [], pedidos: [], stock: [] }); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar(); }, []);

  const filas = useMemo(() => {
    if (!data) return {};
    const s = (x) => !sede || x.sede === sede;
    const out = {
      stock: data.stock.filter((x) => s(x) && x.cantidad > 0),
      pedidos: data.pedidos.filter(s),
      faltantes: data.pedidos.filter((p) => s(p) && !p.anulado)
        .flatMap((p) => (p.items || []).filter((i) => i.cantidad > (i.entregado || 0)).map((i) => ({ p, i }))),
    };
    for (const [k, v] of Object.entries(TABS)) if (v.tipo) out[k] = data.movs.filter((m) => s(m) && v.tipo.includes(m.tipo));
    return out;
  }, [data, sede]);

  const unidades = (k) => (filas[k] || []).reduce((a, x) => a + (Number(x.cantidad) || 0), 0);
  const cfg = TABS[tab];
  const rows = filas[tab] || [];
  const rango = `${desde}_a_${hasta}`;

  return (
    <>
      <h1>Reportes</h1>
      <Alerta msg={msg} onClose={() => setMsg(null)} />
      <div className="card row noprint">
        <div><label>Desde</label><input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
        <div><label>Hasta</label><input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
        <div><label>Sede</label>
          <select value={sede} onChange={(e) => setSede(e.target.value)}>
            <option value="">Todas</option>{SEDES.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </select>
        </div>
        <div style={{ alignSelf: 'flex-end' }}><button className="btn" onClick={cargar}>Generar</button></div>
      </div>

      {!data ? <Cargando /> : (
        <>
          <div className="stats noprint">
            <div className="stat"><b>{unidades('stock')}</b><span>Unidades en stock</span></div>
            <div className="stat"><b>{unidades('entregas')}</b><span>Unidades entregadas</span></div>
            <div className="stat"><b>{unidades('reasignaciones')}</b><span>Reasignadas</span></div>
            <div className="stat"><b>{unidades('cambios')}</b><span>Cambios</span></div>
            <div className="stat"><b>{unidades('devoluciones')}</b><span>Devueltas a stock</span></div>
            <div className="stat"><b>{filas.pedidos?.length || 0}</b><span>Pedidos en el período</span></div>
          </div>
          <div className="tabs">
            {Object.entries(TABS).map(([k, v]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{v.t} ({filas[k]?.length || 0})</button>)}
          </div>
          <div className="card">
            <div className="row between">
              <div>
                <h2 style={{ margin: 0 }}>{APP_NAME} — {cfg.t}</h2>
                <div className="muted">{tab === 'stock' ? `Al ${fmtFecha(new Date())}` : `Del ${desde} al ${hasta}`} · {sede ? sedeNombre(sede) : 'Todas las sedes'}</div>
              </div>
              <div className="row noprint">
                <button className="btn sec" onClick={() => descargarCSV(`${tab}_${rango}`, cfg.cols, rows)}>⬇ Excel (CSV)</button>
                <button className="btn sec" onClick={() => window.print()}>🖨 Imprimir / PDF</button>
              </div>
            </div>
            <div style={{ height: 12 }} />
            <div className="tablewrap">
              <table>
                <thead><tr>{cfg.cols.map((c) => <th key={c.h}>{c.h}</th>)}</tr></thead>
                <tbody>
                  {rows.map((r, i) => <tr key={i}>{cfg.cols.map((c) => <td key={c.h}>{c.v(r)}</td>)}</tr>)}
                  {!rows.length && <tr><td colSpan={cfg.cols.length} className="muted">Sin registros en este período.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
