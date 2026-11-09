'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { buscarPedidoPorNumero } from '@/lib/data';
import { sedeNombre } from '@/lib/config';
import { fmtFecha } from '@/lib/utils';
import { Alerta, Badge } from '@/components/ui';
import { FormRecepcion, useRecepcion, guardarLlegada } from '@/components/Recepcion';

export default function RecibirPedido() {
  const router = useRouter();
  const input = useRef(null);
  const [numero, setNumero] = useState('');
  const [buscado, setBuscado] = useState('');
  const [p, setP] = useState(undefined); // undefined = sin buscar, null = no existe
  const [msg, setMsg] = useState(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => { input.current?.focus(); }, []);

  async function buscar(e) {
    e?.preventDefault();
    const n = numero.trim();
    if (!n) return;
    setCargando(true); setMsg(null);
    try { setP(await buscarPedidoPorNumero(n)); setBuscado(n.toUpperCase()); }
    catch (err) { setMsg({ type: 'error', text: err.message }); }
    setCargando(false);
  }

  function siguiente(texto) {
    setMsg({ type: 'ok', text: texto });
    setP(undefined); setNumero(''); setBuscado('');
    setTimeout(() => input.current?.focus(), 50);
  }

  return (
    <>
      <h1>📥 Recibir pedido en la sede</h1>
      <p className="muted" style={{ marginTop: -8 }}>Escribe el número del pedido que llegó. Si ya estaba registrado, confirma lo que llegó; si no, puedes registrarlo directamente como recibido.</p>
      <Alerta msg={msg} onClose={() => setMsg(null)} />

      <form className="card row" onSubmit={buscar}>
        <input ref={input} style={{ flex: 1, minWidth: 220, fontSize: '1.1rem' }} placeholder="N° de pedido"
          value={numero} onChange={(e) => setNumero(e.target.value)} />
        <button className="btn" disabled={cargando}>{cargando ? 'Buscando…' : 'Buscar'}</button>
      </form>

      {p === null && (
        <div className="card">
          <h2>El pedido {buscado} no está registrado</h2>
          <p className="muted">Puede que no se haya registrado cuando el alumno lo hizo. Regístralo ahora como pedido ya recibido en la sede: los datos del alumno y los artículos se traerán de la tienda en línea.</p>
          <div className="row">
            <button className="btn ok" onClick={() => router.push(`/admin/pedidos/nuevo?numero=${encodeURIComponent(buscado)}&llego=1`)}>➕ Registrar como pedido recibido</button>
            <button className="btn sec" onClick={() => { setP(undefined); input.current?.focus(); }}>Buscar otro número</button>
          </div>
        </div>
      )}

      {p && <Encontrado key={p.id + (p.recibidoEn ? 'r' : '')} p={p} onListo={siguiente} />}
    </>
  );
}

function Encontrado({ p, onListo }) {
  const r = useRecepcion(p);
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState('');

  async function confirmar() {
    setGuardando(true); setErr('');
    try {
      const nuevo = await guardarLlegada(p, r);
      onListo(`Pedido ${nuevo.numero} registrado en la sede (${nuevo.estado === 'recibido' ? 'completo' : 'incompleto'}).`);
    } catch (e) { setErr(e.message); setGuardando(false); }
  }

  return (
    <div className="card">
      <div className="row between">
        <div>
          <h2 style={{ margin: 0 }}>Pedido {p.numero} <Badge estado={p.estado} /></h2>
          <div className="muted">{p.alumno?.nombre} · C.I. {p.alumno?.cedula} · Tel. {p.alumno?.telefono || '—'}</div>
          <div className="muted">De {sedeNombre(p.origen)} → retira en {sedeNombre(p.sede)} · Pedido realizado el {fmtFecha(p.creadoEn, false)}</div>
        </div>
        <Link className="btn sec sm" href={`/admin/pedidos/${p.id}`}>Ver ficha completa</Link>
      </div>

      {p.anulado ? <div className="alert error" style={{ marginTop: 14 }}>Este pedido está anulado.</div> : (
        <>
          {p.recibidoEn && <div className="alert info" style={{ marginTop: 14 }}>Este pedido ya se registró en la sede el {fmtFecha(p.recibidoEn)}. Puedes actualizar lo recibido (por ejemplo, si llegó lo que faltaba).</div>}
          <div style={{ height: 12 }} />
          <FormRecepcion p={p} r={r} />
          {err && <div className="alert error" style={{ marginTop: 12 }}>{err}</div>}
          <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
            <button className="btn ok" disabled={guardando} onClick={confirmar}>{guardando ? 'Guardando…' : '✅ Confirmar llegada a la sede'}</button>
          </div>
        </>
      )}
    </div>
  );
}
