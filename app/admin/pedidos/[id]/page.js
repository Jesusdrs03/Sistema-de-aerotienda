'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  obtenerPedido, listarArticulos, registrarEntrega, enviarAStock,
  registrarCambio, anularPedido, editarAlumno, registrarAviso,
} from '@/lib/data';
import { sedeNombre, MOTIVOS_DEVOLUCION, MOTIVOS_CAMBIO, AVISOS } from '@/lib/config';
import { fmtFecha, normalizarTelefono, tallaTxt, waLink } from '@/lib/utils';
import { construirMensaje, avisoSugerido } from '@/lib/mensajes';
import { Alerta, Badge, Campo, Cargando, Modal } from '@/components/ui';
import { FormRecepcion, useRecepcion, guardarLlegada } from '@/components/Recepcion';

export default function DetallePedido() {
  const { id: rawId } = useParams();
  const id = decodeURIComponent(rawId);
  const [p, setP] = useState(undefined);
  const [articulos, setArticulos] = useState([]);
  const [modal, setModal] = useState(null);
  const [msg, setMsg] = useState(null);

  const cargar = useCallback(() => obtenerPedido(id).then(setP).catch((e) => setMsg({ type: 'error', text: e.message })), [id]);

  useEffect(() => {
    cargar();
    listarArticulos().then(setArticulos);
    if (document.referrer.includes('/pedidos/nuevo')) setMsg({ type: 'ok', text: 'Pedido registrado' });
  }, [cargar]);

  async function ejecutar(fn, ok) {
    try { await fn(); setModal(null); setMsg({ type: 'ok', text: ok }); await cargar(); }
    catch (e) { setMsg({ type: 'error', text: e.message }); setModal(null); }
  }

  // Registra la entrega y, si se pidió, abre WhatsApp con la confirmación (la ventana se abre antes de esperar)
  async function entregarYAvisar(entregas, opt, conAviso) {
    const tel = p.alumno?.telefono;
    const ventana = conAviso && tel ? window.open('about:blank', '_blank') : null;
    try {
      await registrarEntrega(p.id, entregas, opt);
      if (ventana) {
        const nuevo = await obtenerPedido(p.id);
        ventana.location.href = waLink(tel, construirMensaje('entrega', nuevo, window.location.origin));
        await registrarAviso(p.id, 'entrega').catch(() => {});
      }
    } catch (e) { if (ventana) ventana.close(); throw e; }
  }

  async function avisar(tipo) {
    await registrarAviso(p.id, tipo).catch(() => {});
    cargar();
  }

  if (p === undefined) return <Cargando />;
  if (p === null) return <div className="alert error">No existe el pedido {id}. <Link href="/admin/pedidos">Volver</Link></div>;

  const activo = !p.anulado;
  const items = p.items || [];
  const tel = normalizarTelefono(p.alumno?.telefono);
  const sugerido = avisoSugerido(p);
  const enlace = (tipo) => waLink(tel, construirMensaje(tipo, p, window.location.origin));
  const NOMBRE_AVISO = Object.fromEntries(AVISOS.map((a) => [a.id, a.nombre]));

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
            <button className="btn" onClick={() => setModal({ t: 'recepcion' })}>{p.recibidoEn ? '📥 Actualizar lo recibido' : '📥 Registrar llegada a la sede'}</button>
            {p.estado !== 'entregado' && <button className="btn ok" onClick={() => setModal({ t: 'entrega' })}>✅ Entregar al alumno</button>}
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
          <h2>Avisar al alumno por WhatsApp</h2>
          {!tel ? <p className="muted">El alumno no tiene teléfono registrado. Agrégalo con el botón Editar.</p> : (
            <>
              <p className="muted" style={{ marginTop: -6 }}>Se abre WhatsApp con el mensaje ya escrito para {p.alumno?.telefono}. Solo tienes que darle a enviar.</p>
              <div className="row">
                {AVISOS.map((a) => (
                  <a key={a.id} className={`btn sm ${a.id === sugerido ? 'wa' : 'sec'}`} href={enlace(a.id)} target="_blank" rel="noreferrer" onClick={() => avisar(a.id)}>
                    {a.id === sugerido ? '💬 ' : ''}{a.nombre}
                  </a>
                ))}
              </div>
            </>
          )}
          <ul className="timeline" style={{ marginTop: 12 }}>
            {[...(p.notificaciones || [])].filter((n) => n.canal === 'whatsapp').reverse().slice(0, 6).map((n, i) => (
              <li key={i}>💬 {NOMBRE_AVISO[n.tipo] || n.tipo} <span className="muted">· {fmtFecha(n.fecha)} · {n.usuario}</span></li>
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
                          {it.cantidad > (it.entregado || 0) && <button className="btn ok sm" onClick={() => setModal({ t: 'entrega', idx: i })}>✅ Entregar</button>}
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

      {modal?.t === 'recepcion' && <RecepcionModal p={p} onClose={() => setModal(null)} onOk={(r) => ejecutar(() => guardarLlegada(p, r), 'Llegada registrada')} />}
      {modal?.t === 'entrega' && <EntregaModal p={p} soloIdx={modal.idx} onClose={() => setModal(null)} onOk={(e, opt, av) => ejecutar(() => entregarYAvisar(e, opt, av), 'Entrega registrada')} />}
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
  const r = useRecepcion(p);
  const [b, run] = useEnviando();
  return (
    <Modal titulo={p.recibidoEn ? 'Actualizar lo recibido' : 'Registrar llegada a la sede'} onClose={onClose} footer={<>
      <button className="btn sec" onClick={onClose}>Cancelar</button>
      <button className="btn" disabled={b} onClick={() => run(() => onOk(r))}>Guardar</button>
    </>}>
      <p className="muted">Indica el total recibido de cada artículo. Si llegó de más (repetido), ponlo en “Sobrante” y pasará al stock.</p>
      <FormRecepcion p={p} r={r} />
    </Modal>
  );
}

function EntregaModal({ p, soloIdx, onClose, onOk }) {
  const pend = (it) => Math.max(0, it.cantidad - (it.entregado || 0));
  const lineas = p.items.map((it, i) => ({ it, i })).filter(({ it }) => it.cantidad > 0);
  const [marcado, setMarcado] = useState(p.items.map((it, i) => pend(it) > 0 && (soloIdx == null || soloIdx === i)));
  const [cant, setCant] = useState(p.items.map((it) => pend(it)));
  const [desdeStock, setDesdeStock] = useState(!p.recibidoEn && p.origen === p.sede);
  const [obs, setObs] = useState('');
  const [avisar, setAvisar] = useState(!!p.alumno?.telefono);
  const [b, run] = useEnviando();
  const pendientes = lineas.filter(({ it }) => pend(it) > 0);
  const todos = pendientes.length > 0 && pendientes.every(({ i }) => marcado[i]);
  const entregas = p.items.map((it, i) => (marcado[i] ? Math.min(Number(cant[i]) || 0, pend(it)) : 0));
  const total = entregas.reduce((a, n) => a + n, 0);
  return (
    <Modal titulo="Entregar al alumno" onClose={onClose} footer={<>
      <button className="btn sec" onClick={onClose}>Cancelar</button>
      <button className="btn ok" disabled={b || !total} onClick={() => run(() => onOk(entregas, { desdeStock, observacion: obs }, avisar))}>
        Registrar entrega{total ? ` (${total})` : ''}
      </button>
    </>}>
      <p className="muted" style={{ marginTop: -4 }}>Marca los artículos que se le entregan al alumno ahora.</p>
      <div className="tablewrap"><table>
        <thead><tr>
          <th style={{ width: 40 }}><input type="checkbox" title="Marcar todos" checked={todos} disabled={!pendientes.length}
            onChange={(e) => setMarcado(p.items.map((it) => e.target.checked && pend(it) > 0))} /></th>
          <th>Artículo</th><th>Pedido</th><th>Ya entregado</th><th>Cantidad a entregar</th>
        </tr></thead>
        <tbody>{lineas.map(({ it, i }) => {
          const falta = pend(it);
          return (
            <tr key={i} style={{ opacity: falta ? 1 : 0.55, cursor: falta ? 'pointer' : 'default' }}
              onClick={(e) => { if (falta && e.target.tagName !== 'INPUT') setMarcado(marcado.map((v, j) => (j === i ? !v : v))); }}>
              <td>{falta ? <input type="checkbox" checked={marcado[i]} onChange={(e) => setMarcado(marcado.map((v, j) => (j === i ? e.target.checked : v)))} /> : '✅'}</td>
              <td><b>{it.nombre}</b> <span className="muted">({tallaTxt(it.talla)})</span></td>
              <td>{it.cantidad}</td>
              <td>{it.entregado || 0}{!falta && <span className="badge green" style={{ marginLeft: 6 }}>Completo</span>}</td>
              <td>{falta > 1
                ? <input className="w80" type="number" min="1" max={falta} value={cant[i]} disabled={!marcado[i]} onChange={(e) => setCant(cant.map((v, j) => (j === i ? e.target.value : v)))} />
                : falta === 1 ? <span className="muted">1</span> : '—'}</td>
            </tr>
          );
        })}</tbody>
      </table></div>
      <div style={{ height: 12 }} />
      <label className="chk"><input type="checkbox" checked={desdeStock} onChange={(e) => setDesdeStock(e.target.checked)} /> Tomar del stock de {sedeNombre(p.sede)} (venta directa en tienda o reposición de faltantes)</label>
      {p.alumno?.telefono && <label className="chk" style={{ marginTop: 8 }}><input type="checkbox" checked={avisar} onChange={(e) => setAvisar(e.target.checked)} /> Abrir WhatsApp para confirmarle la entrega al alumno</label>}
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
