'use client';
import { useEffect, useState } from 'react';
import { APP_NAME } from '@/lib/config';
import { fmtFecha } from '@/lib/utils';
import { Badge } from '@/components/ui';
import EscanerNumero from '@/components/EscanerNumero';

const PASOS = [
  { k: 'registrado', t: 'Pedido realizado' },
  { k: 'recibido', t: 'Llegó a la sede' },
  { k: 'entregado', t: 'Entregado' },
];

function paso(estado) {
  if (estado === 'entregado') return 3;
  if (['recibido', 'recibido_incompleto', 'entregado_parcial'].includes(estado)) return 2;
  return 1;
}

export default function Consulta() {
  const [numero, setNumero] = useState('');
  const [res, setRes] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function buscar(n) {
    const v = (n ?? numero).trim();
    if (!v) return;
    setCargando(true); setError(''); setRes(null);
    try {
      const r = await fetch(`/api/consulta?numero=${encodeURIComponent(v)}`);
      const j = await r.json();
      if (!r.ok) setError(j.error || 'No encontrado'); else setRes(j);
    } catch { setError('No se pudo consultar. Intenta de nuevo.'); }
    setCargando(false);
  }

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('pedido');
    if (q) { setNumero(q); buscar(q); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const p = res ? paso(res.estado) : 0;

  return (
    <>
      <div className="hero">
        <div style={{ fontSize: 36 }}>✈️</div>
        <h1>{APP_NAME}</h1>
        <p style={{ opacity: .85, margin: 0 }}>Consulta el estado de tu pedido con tu número de pedido</p>
      </div>
      <div className="public">
        <div className="card">
          <form className="row" onSubmit={(e) => { e.preventDefault(); buscar(); }}>
            <input style={{ flex: 1, minWidth: 200, fontSize: '1.05rem' }} placeholder="Ej: BQTO-2026-0012"
              value={numero} onChange={(e) => setNumero(e.target.value)} />
            <EscanerNumero onDetectado={(v) => { setNumero(v); buscar(v); }} titulo="Escanear mi número de pedido" />
            <button className="btn" disabled={cargando}>{cargando ? 'Buscando…' : 'Consultar'}</button>
          </form>
          {error && <div className="alert error" style={{ marginTop: 14, marginBottom: 0 }}>{error}</div>}
        </div>

        {res && (
          <div className="card">
            <div className="row between">
              <div>
                <h2 style={{ margin: 0 }}>Pedido {res.numero}</h2>
                <div className="muted">{res.alumno} · Retiro en: <b>{res.sede}</b></div>
              </div>
              <Badge estado={res.estado} />
            </div>
            <div className="steps">
              {PASOS.map((s, i) => <div key={s.k} className={i < p ? 'on' : ''}><i />{s.t}</div>)}
            </div>
            {res.estado === 'recibido_incompleto' && (
              <div className="alert info">Tu pedido llegó, pero faltan algunos artículos. Puedes retirar lo disponible; te avisaremos cuando llegue lo que falta.</div>
            )}
            <div className="tablewrap">
              <table>
                <thead><tr><th>Artículo</th><th>Talla</th><th>Cant.</th><th>Llegó</th><th>Entregado</th></tr></thead>
                <tbody>
                  {res.items.map((i, k) => (
                    <tr key={k}>
                      <td>{i.nombre}</td><td>{i.talla}</td><td className="num">{i.cantidad}</td>
                      <td>{i.recibido >= i.cantidad ? '✅' : i.recibido > 0 ? `${i.recibido}/${i.cantidad}` : '⏳'}</td>
                      <td>{i.entregado >= i.cantidad ? '✅' : i.entregado > 0 ? `${i.entregado}/${i.cantidad}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted" style={{ marginBottom: 0 }}>
              Pedido realizado: {fmtFecha(res.creadoEn)}
              {res.recibidoEn && <> · Llegó: {fmtFecha(res.recibidoEn)}</>}
              {res.entregadoEn && <> · Entregado: {fmtFecha(res.entregadoEn)}</>}
            </p>
          </div>
        )}
        <p style={{ textAlign: 'center' }}><a href="/login" className="muted">Acceso administrador</a></p>
      </div>
    </>
  );
}
