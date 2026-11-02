'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  obtenerPedido, listarArticulos, registrarRecepcion, registrarEntrega, enviarAStock,
  registrarCambio, anularPedido, editarAlumno, notificar,
} from '@/lib/data';
import { sedeNombre, MOTIVOS_DEVOLUCION, MOTIVOS_CAMBIO, CANALES } from '@/lib/config';
import { fmtFecha, normalizarTelefono, tallaTxt } from '@/lib/utils';
import { construirMensaje } from '@/lib/mensajes';
import { Alerta, Badge, Campo, Cargando, Modal } from '@/components/ui';

export default function DetallePedido() {
  const { id: rawId } = useParams();
  const id = decodeURIComponent(rawId);
  const [p, setP] = useState(undefined);
  const [articulos, setArticulos] = useState([]);
  const [modal, setModal] = useState(null);
  const [msg, setMsg] = useState(null);
  const [canal, setCanal] = useState(process.env.NEXT_PUBLIC_DEFAULT_CHANNEL || 'sms');
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(() => obtenerPedido(id).then(setP).catch((e) => setMsg({ type: 'error', text: e.message })), [id]);

  useEffect(() => {
    cargar();
    listarArticulos().then(setArticulos);
    const r = sessionStorage.getItem('notifResult');
    if (r) {
      sessionStorage.removeItem('notifResult');
      const j = JSON.parse(r);
      setMsg(j.ok
        ? { type: 'ok', text: `Pedido registrado y mensaje enviado por ${j.canal} a ${j.telefono}` }
        : { type: 'error', text: `Pedido registrado, pero el mensaje no se envió: ${j.error}. Puedes usar el botón de WhatsApp manual.` });
    } else if (document.referrer.includes('/pedidos/nuevo')) setMsg({ type: 'ok', text: 'Pedido registrado' });
  }, [cargar]);

  async function ejecutar(fn, ok) {
    try { await fn(); setModal(null); setMsg({ type: 'ok', text: ok }); await cargar(); }
    catch (e) { setMsg({ type: 'error', text: e.message }); setModal(null); }
  }

  async function enviarNotif(tipo) {
    setEnviando(true);
    const r = await notificar(p.id, tipo, canal);
    setEnviando(false);
    setMsg(r.ok ? { type: 'ok', text: `Mensaje enviado por ${r.canal} a ${r.telefono}` } : { type: 'error', text: `No se envió: ${r.error}` });
    cargar();
  }

  if (p === undefined) return <Cargando />;
  if (p === null) return <div className="alert error">No existe el pedido {id}. <Link href="/admin/pedidos">Volver</Link></div>;

  const activo = !p.anulado;
  const items = p.items || [];
  const tel = normalizarTelefono(p.alumno?.telefono);
  const tipoMsg = p.recibidoEn ? 'llegada' : 'registro';
  const waLink = tel ? `https://wa.me/${tel.replace('+', '')}?text=${encodeURIComponent(construirMensaje(tipoMsg, p, window.location.origin))}` : null;

  return (
    <>
      <div className="row between">
        <div>
          <Link href="/admin/pedidos" className="muted">← Pedidos</Link>
          <h1 style={{ margin: '4px 0' }}>Pedido {p.numero} <Badge estado={p.estado} /></h1>
          <div className="muted">De {sedeNombre(p.origen)} → retira en {sedeNombre(p.sede)} · Registrado {fmtFecha(p.creadoEn)} por {p.creadoPor}</div>
        </div>
        {activo && (
          <div className="row noprint">
            <button className="btn" onClick={() => setModal({ t: 'recepcion' })}>📥 Registrar llegada</button>
            <button className="btn ok" onClick={() => setModal({ t: 'entrega' })}>✅ Entregar al alumno</button>
          </div>
        )}
      </div>
      <div style={{ height: 14 }} />
      <Alerta msg={msg} onClose={() => setMsg(null)} />

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <div className="card">
          <div className="row between"><h2>Alumno</h2>{activo && <button className="btn sec sm" onClick={() => setModal({ t: 'alumno' })}>Editar</button>}</div>
          <b>{p.alumno?.nombre}</b>
          <div>C.I.: {p.alumno?.cedula || '—'}</div>
          <div>Teléfono: {p.alumno?.telefono || '—'}</div>
          <div>Correo: {p.alumno?.email || '—'}</div>
          <div>Curso: {p.alumno?.curso || '—'}</div>
          {p.notas && <p className="muted">Notas: {p.notas}</p>}
        </div>
        <div className="card noprint">
          <h2>Mensajes al alumno</h2>
          <div className="row">
            <select style={{ width: 'auto' }} value={canal} onChange={(e) => setCanal(e.target.value)}>
              {CANALES.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn sec sm" disabled={enviando || !tel} onClick={() => enviarNotif('registro')}>Reenviar registro</button>
            <button className="btn sec sm" disabled={enviando || !tel} onClick={() => enviarNotif('llegada')}>Avisar llegada</button>
            <button className="btn sec sm" disabled={enviando || !tel} onClick={() => enviarNotif('entrega')}>Confirmar entrega</button>
            {waLink && <a className="btn wa sm" href={waLink} target="_blank" rel="noreferrer">WhatsApp manual</a>}
          </div>
          {!tel && <p className="muted">El alumno no tiene teléfono registrado.</p>}
          <ul className="timeline" style={{ marginTop: 12 }}>
            {[...(p.notificaciones || [])].reverse().slice(0, 5).map((n, i) => (
              <li key={i}>
                <span className={`badge ${n.ok ? 'green' : 'red'}`}>{n.ok ? 'Enviado' : 'Falló'}</span> {n.tipo} · {n.canal} · {fmtFecha(n.fecha)}
                {n.error && <div className="muted">{n.error}</div>}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card">
        <h2>Artículos</h2>
        <div className="tablewrap">
          <table>
            <thead><tr><th>Artículo</th><th>Talla</th><th>Pedido</th><th>Llegó</th><th>Entregado</th><th>A stock</th><th className="noprint"></th></tr></thead>
            <tbody>
              {items.map((it, i) => {
                const falta = p.recibidoEn && (it.recibido || 0) < it.cantidad;
                return (
                  <tr key={i} style={{ opacity: it.cantidad === 0 ? .55 : 1 }}>
                    <td>
                      <b>{it.nombre}</b>
                      {it.origenCambio && <div className="muted">🔄 Cambio de {it.origenCambio}</div>}
                      {it.cambiado > 0 && <div className="muted">🔄 {it.cambiado} cambiado(s)</div>}
                    </td>
                    <td>{tallaTxt(it.talla)}</td>
                    <td className="num">{it.cantidad}</td>
                    <td className="num">{p.recibidoEn || it.recibido ? it.recibido || 0 : '—'} {falta && <span className="badge orange">Falta {it.cantidad - (it.recibido || 0)}</span>}</td>
                    <td className="num">{it.entregado || 0} {it.cantidad > 0 && (it.entregado || 0) >= it.cantidad && '✅'}</td>
                    <td className="num">{it.devuelto || 0}</td>
                    <td className="noprint">
                      {activo && (
                        <div className="row">
                          <button className="btn sec sm" onClick={() => setModal({ t: 'stock', idx: i })}>↩ A stock</button>
                          {it.cantidad > 0 && <button className="btn sec sm" onClick={() => setModal({ t: 'cambio', idx: i })}>🔄 Cambio</button>}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <div className="card">
          <h2>Historial</h2>
          <ul className="timeline">
            {[...(p.historial || [])].reverse().map((h, i) => (
              <li key={i}><b>{h.accion}</b> <span className="muted">· {fmtFecha(h.fecha)} · {h.usuario}</span>{h.detalle && <div>{h.detalle}</div>}</li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h2>Cambios y reasignaciones</h2>
          {!(p.cambios?.length || p.reasignaciones?.length) && <p className="muted">Sin cambios ni reasignaciones.</p>}
          <ul className="timeline">
            {(p.cambios || []).map((c, i) => <li key={'c' + i}>🔄 {c.de} → <b>{c.a}</b> x{c.cantidad} <div className="muted">{c.motivo} · {fmtFecha(c.fecha)}</div></li>)}
            {(p.reasignaciones || []).map((r, i) => <li key={'r' + i}>🏷️ Reasignado desde stock: <b>{r.articulo}</b><div className="muted">{fmtFecha(r.fecha)} {r.nota}</div></li>)}
          </ul>
          {activo && <button className="btn danger sm noprint" style={{ marginTop: 14 }} onClick={() => setModal({ t: 'anular' })}>Anular pedido</button>}
        </div>
      </div>

      {modal?.t === 'recepcion' && <RecepcionModal p={p} onClose={() => setModal(null)} onOk={(r, s, o) => ejecutar(() => registrarRecepcion(p.id, r, s, o), 'Llegada registrada')} />}
      {modal?.t === 'entrega' && <EntregaModal p={p} onClose={() => setModal(null)} onOk={(e, opt) => ejecutar(() => registrarEntrega(p.id, e, opt), 'Entrega registrada')} />}
      {modal?.t === 'stock' && <StockModal it={items[modal.idx]} onClose={() => setModal(null)} onOk={(c, m, n) => ejecutar(() => enviarAStock(p.id, modal.idx, c, m, n), 'Enviado a stock')} />}
      {modal?.t === 'cambio' && <CambioModal it={items[modal.idx]} articulos={articulos} sede={p.sede} onClose={() => setModal(null)} onOk={(d) => ejecutar(() => registrarCambio(p.id, modal.idx, d), 'Cambio registrado')} />}
      {modal?.t === 'alumno' && <AlumnoModal alumno={p.alumno} onClose={() => setModal(null)} onOk={(a) => ejecutar(() => editarAlumno(p.id, a), 'Datos actualizados')} />}
      {modal?.t === 'anular' && <AnularModal onClose={() => setModal(null)} onOk={(m) => ejecutar(() => anularPedido(p.id, m), 'Pedido anulado')} />}
    </>
  );
}

function useEnviando() {
  const [b, setB] = useState(false);
  return [b, async (fn) => { setB(true); try { await fn(); } finally { setB(false); } }];
}

function RecepcionModal({ p, onClose, onOk }) {
  const [rec, setRec] = useState(p.items.map((i) => (p.recibidoEn ? i.recibido || 0 : i.cantidad)));
  const [sob, setSob] = useState(p.items.map(() => 0));
  const [obs, setObs] = useState('');
  const [b, run] = useEnviando();
  const completo = p.items.every((it, i) => Number(rec[i]) >= it.cantidad);
  return (
    <Modal titulo="Registrar llegada a la sede" onClose={onClose} footer={<>
      <button className="btn sec" onClick={onClose}>Cancelar</button>
      <button className="btn" disabled={b} onClick={() => run(() => onOk(rec, sob, obs))}>Guardar</button>
    </>}>
      <p className="muted">Indica cuántas unidades llegaron de cada artículo. Si llegó de más (repetido), ponlo en “Sobrante” y pasará al stock.</p>
      <div className="tablewrap"><table>
        <thead><tr><th>Artículo</th><th>Pedido</th><th>Llegó</th><th>Sobrante → stock</th></tr></thead>
        <tbody>{p.items.map((it, i) => (
          <tr key={i}>
            <td>{it.nombre} ({tallaTxt(it.talla)})</td><td>{it.cantidad}</td>
            <td><input className="w80" type="number" min="0" value={rec[i]} onChange={(e) => setRec(rec.map((v, j) => (j === i ? e.target.value : v)))} /></td>
            <td><input className="w80" type="number" min="0" value={sob[i]} onChange={(e) => setSob(sob.map((v, j) => (j === i ? e.target.value : v)))} /></td>
          </tr>
        ))}</tbody>
      </table></div>
      <div className={`alert ${completo ? 'ok' : 'error'}`} style={{ marginTop: 12 }}>{completo ? '✅ Llegó todo correctamente' : '⚠️ El pedido llegó incompleto'}</div>
      <Campo label="Observación"><input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ej: faltó la gorra, llega en el próximo envío" /></Campo>
    </Modal>
  );
}

function EntregaModal({ p, onClose, onOk }) {
  const [ent, setEnt] = useState(p.items.map((i) => Math.max(0, i.cantidad - (i.entregado || 0))));
  const [desdeStock, setDesdeStock] = useState(!p.recibidoEn && p.origen === p.sede);
  const [obs, setObs] = useState('');
  const [b, run] = useEnviando();
  return (
    <Modal titulo="Entregar al alumno" onClose={onClose} footer={<>
      <button className="btn sec" onClick={onClose}>Cancelar</button>
      <button className="btn ok" disabled={b} onClick={() => run(() => onOk(ent, { desdeStock, observacion: obs }))}>Registrar entrega</button>
    </>}>
      <div className="tablewrap"><table>
        <thead><tr><th>Artículo</th><th>Pedido</th><th>Ya entregado</th><th>Entregar ahora</th></tr></thead>
        <tbody>{p.items.filter((it) => it.cantidad > 0).map((it) => {
          const i = p.items.indexOf(it);
          return (
            <tr key={i}>
              <td>{it.nombre} ({tallaTxt(it.talla)})</td><td>{it.cantidad}</td><td>{it.entregado || 0}</td>
              <td><input className="w80" type="number" min="0" max={it.cantidad - (it.entregado || 0)} value={ent[i]} onChange={(e) => setEnt(ent.map((v, j) => (j === i ? e.target.value : v)))} /></td>
            </tr>
          );
        })}</tbody>
      </table></div>
      <div style={{ height: 12 }} />
      <label className="chk"><input type="checkbox" checked={desdeStock} onChange={(e) => setDesdeStock(e.target.checked)} /> Tomar del stock de {sedeNombre(p.sede)} (venta directa en tienda o reposición de faltantes)</label>
      <div style={{ height: 10 }} />
      <Campo label="Observación"><input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ej: retiró su representante" /></Campo>
    </Modal>
  );
}

function StockModal({ it, onClose, onOk }) {
  const [c, setC] = useState(1);
  const [m, setM] = useState(MOTIVOS_DEVOLUCION[0]);
  const [n, setN] = useState('');
  const [b, run] = useEnviando();
  return (
    <Modal titulo={`Enviar a stock: ${it.nombre} (${tallaTxt(it.talla)})`} onClose={onClose} footer={<>
      <button className="btn sec" onClick={onClose}>Cancelar</button>
      <button className="btn warn" disabled={b} onClick={() => run(() => onOk(c, m, n))}>Enviar a stock</button>
    </>}>
      <p className="muted">Usa esto cuando un artículo llegó repetido, sobró o el alumno lo devolvió. Quedará disponible en stock para reasignarlo a otro alumno.</p>
      <div className="grid">
        <Campo label="Cantidad"><input type="number" min="1" value={c} onChange={(e) => setC(e.target.value)} /></Campo>
        <Campo label="Motivo"><select value={m} onChange={(e) => setM(e.target.value)}>{MOTIVOS_DEVOLUCION.map((x) => <option key={x}>{x}</option>)}</select></Campo>
      </div>
      <div style={{ height: 10 }} />
      <Campo label="Nota"><input value={n} onChange={(e) => setN(e.target.value)} /></Campo>
      {m === 'Devuelto por el alumno' && <p className="muted">Se descontará de lo entregado al alumno.</p>}
    </Modal>
  );
}

function CambioModal({ it, articulos, sede, onClose, onOk }) {
  const [c, setC] = useState(1);
  const [artId, setArtId] = useState(it.articuloId);
  const [talla, setTalla] = useState('');
  const [m, setM] = useState(MOTIVOS_CAMBIO[0]);
  const [n, setN] = useState('');
  const [b, run] = useEnviando();
  const art = articulos.find((a) => a.id === artId);
  const ok = art && (!art.tallas?.length || talla);
  return (
    <Modal titulo={`Cambio: ${it.nombre} (${tallaTxt(it.talla)})`} onClose={onClose} footer={<>
      <button className="btn sec" onClick={onClose}>Cancelar</button>
      <button className="btn" disabled={b || !ok} onClick={() => run(() => onOk({ cantidad: c, motivo: m, nota: n, nuevo: { articuloId: art.id, nombre: art.nombre, talla: talla || 'Única' } }))}>Registrar cambio</button>
    </>}>
      <p className="muted">El artículo actual vuelve al stock de {sedeNombre(sede)} y el nuevo se entrega desde ese mismo stock.</p>
      <div className="grid">
        <Campo label="Cantidad"><input type="number" min="1" max={it.cantidad} value={c} onChange={(e) => setC(e.target.value)} /></Campo>
        <Campo label="Nuevo artículo"><select value={artId} onChange={(e) => { setArtId(e.target.value); setTalla(''); }}>{articulos.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></Campo>
        {art?.tallas?.length > 0 && <Campo label="Nueva talla"><select value={talla} onChange={(e) => setTalla(e.target.value)}><option value="">—</option>{art.tallas.map((t) => <option key={t}>{t}</option>)}</select></Campo>}
        <Campo label="Motivo"><select value={m} onChange={(e) => setM(e.target.value)}>{MOTIVOS_CAMBIO.map((x) => <option key={x}>{x}</option>)}</select></Campo>
      </div>
      <div style={{ height: 10 }} />
      <Campo label="Nota"><input value={n} onChange={(e) => setN(e.target.value)} /></Campo>
    </Modal>
  );
}

function AlumnoModal({ alumno, onClose, onOk }) {
  const [a, setA] = useState({ nombre: '', cedula: '', telefono: '', email: '', curso: '', ...alumno });
  const [b, run] = useEnviando();
  const set = (k) => (e) => setA({ ...a, [k]: e.target.value });
  return (
    <Modal titulo="Editar datos del alumno" onClose={onClose} footer={<>
      <button className="btn sec" onClick={onClose}>Cancelar</button>
      <button className="btn" disabled={b} onClick={() => run(() => onOk(a))}>Guardar</button>
    </>}>
      <div className="grid">
        <Campo label="Nombre"><input value={a.nombre} onChange={set('nombre')} /></Campo>
        <Campo label="Cédula"><input value={a.cedula} onChange={set('cedula')} /></Campo>
        <Campo label="Teléfono"><input value={a.telefono} onChange={set('telefono')} /></Campo>
        <Campo label="Correo"><input value={a.email} onChange={set('email')} /></Campo>
        <Campo label="Curso"><input value={a.curso} onChange={set('curso')} /></Campo>
      </div>
    </Modal>
  );
}

function AnularModal({ onClose, onOk }) {
  const [m, setM] = useState('');
  const [b, run] = useEnviando();
  return (
    <Modal titulo="Anular pedido" onClose={onClose} footer={<>
      <button className="btn sec" onClick={onClose}>Cancelar</button>
      <button className="btn danger" disabled={b || !m} onClick={() => run(() => onOk(m))}>Anular</button>
    </>}>
      <Campo label="Motivo de anulación *"><input value={m} onChange={(e) => setM(e.target.value)} /></Campo>
    </Modal>
  );
}
