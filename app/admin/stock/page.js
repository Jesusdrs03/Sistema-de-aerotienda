'use client';
import { useEffect, useState } from 'react';
import { listarStock, listarArticulos, ajustarStock, reasignarStock } from '@/lib/data';
import { SEDES, sedeNombre } from '@/lib/config';
import { fmtFecha, tallaTxt } from '@/lib/utils';
import { Alerta, Campo, Cargando, Modal } from '@/components/ui';
import { useAdmin } from '@/components/AdminContext';

export default function Stock() {
  const { admin } = useAdmin();
  const [stock, setStock] = useState(null);
  const [articulos, setArticulos] = useState([]);
  const [sede, setSede] = useState(admin?.sede || '');
  const [q, setQ] = useState('');
  const [verCero, setVerCero] = useState(false);
  const [modal, setModal] = useState(null);
  const [msg, setMsg] = useState(null);

  const cargar = () => listarStock().then(setStock).catch((e) => setMsg({ type: 'error', text: e.message }));
  useEffect(() => { cargar(); listarArticulos().then(setArticulos); }, []);

  async function ejecutar(fn, ok) {
    try { await fn(); setModal(null); setMsg({ type: 'ok', text: ok }); cargar(); }
    catch (e) { setMsg({ type: 'error', text: e.message }); setModal(null); }
  }

  const filas = (stock || []).filter((s) => (!sede || s.sede === sede) && (verCero || s.cantidad > 0)
    && `${s.nombre} ${s.talla}`.toLowerCase().includes(q.toLowerCase()));
  const total = filas.reduce((a, s) => a + (s.cantidad || 0), 0);

  return (
    <>
      <div className="row between">
        <h1>Stock y reasignación</h1>
        <button className="btn" onClick={() => setModal({ t: 'ingreso' })}>➕ Ingresar mercancía</button>
      </div>
      <Alerta msg={msg} onClose={() => setMsg(null)} />
      <div className="card row">
        <select style={{ maxWidth: 240 }} value={sede} onChange={(e) => setSede(e.target.value)}>
          <option value="">Todas las sedes</option>
          {SEDES.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
        <input style={{ flex: 1, minWidth: 180 }} placeholder="Buscar artículo…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="chk"><input type="checkbox" checked={verCero} onChange={(e) => setVerCero(e.target.checked)} /> Mostrar en cero</label>
      </div>
      <div className="card">
        <div className="row between"><h2>Existencias</h2><span className="muted">{total} unidad(es)</span></div>
        {!stock ? <Cargando /> : (
          <div className="tablewrap">
            <table>
              <thead><tr><th>Artículo</th><th>Talla</th><th>Sede</th><th>Cantidad</th><th>Actualizado</th><th></th></tr></thead>
              <tbody>
                {filas.map((s) => (
                  <tr key={s.id}>
                    <td><b>{s.nombre}</b></td><td>{s.talla}</td><td>{sedeNombre(s.sede)}</td>
                    <td className="num"><b>{s.cantidad}</b></td><td className="muted">{fmtFecha(s.actualizadoEn)}</td>
                    <td className="row">
                      <button className="btn ok sm" disabled={s.cantidad <= 0} onClick={() => setModal({ t: 'reasignar', s })}>👤 Reasignar</button>
                      <button className="btn sec sm" onClick={() => setModal({ t: 'ajuste', s })}>± Ajustar</button>
                    </td>
                  </tr>
                ))}
                {!filas.length && <tr><td colSpan={6} className="muted">No hay artículos en stock. Lo devuelto, repetido o sobrante de los pedidos aparecerá aquí.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal?.t === 'ingreso' && <IngresoModal articulos={articulos} sedeDef={sede || admin?.sede || SEDES[0].id} onClose={() => setModal(null)}
        onOk={(d) => ejecutar(() => ajustarStock(d), 'Mercancía ingresada al stock')} />}
      {modal?.t === 'ajuste' && <AjusteModal s={modal.s} onClose={() => setModal(null)}
        onOk={(n, m) => ejecutar(() => ajustarStock({ ...modal.s, cantidad: n, motivo: m }), 'Stock ajustado')} />}
      {modal?.t === 'reasignar' && <ReasignarModal s={modal.s} onClose={() => setModal(null)}
        onOk={(d) => ejecutar(() => reasignarStock(modal.s, d), 'Artículo reasignado al alumno')} />}
    </>
  );
}

function IngresoModal({ articulos, sedeDef, onClose, onOk }) {
  const [d, setD] = useState({ sede: sedeDef, articuloId: '', talla: '', cantidad: 1, motivo: 'Ingreso de mercancía' });
  const art = articulos.find((a) => a.id === d.articuloId);
  const ok = art && (!art.tallas?.length || d.talla) && Number(d.cantidad) > 0;
  return (
    <Modal titulo="Ingresar mercancía al stock" onClose={onClose} footer={<>
      <button className="btn sec" onClick={onClose}>Cancelar</button>
      <button className="btn" disabled={!ok} onClick={() => onOk({ ...d, nombre: art.nombre, talla: d.talla || 'Única', cantidad: Number(d.cantidad) })}>Ingresar</button>
    </>}>
      <div className="grid">
        <Campo label="Sede"><select value={d.sede} onChange={(e) => setD({ ...d, sede: e.target.value })}>{SEDES.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></Campo>
        <Campo label="Artículo"><select value={d.articuloId} onChange={(e) => setD({ ...d, articuloId: e.target.value, talla: '' })}><option value="">—</option>{articulos.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></Campo>
        {art?.tallas?.length > 0 && <Campo label="Talla"><select value={d.talla} onChange={(e) => setD({ ...d, talla: e.target.value })}><option value="">—</option>{art.tallas.map((t) => <option key={t}>{t}</option>)}</select></Campo>}
        <Campo label="Cantidad"><input type="number" min="1" value={d.cantidad} onChange={(e) => setD({ ...d, cantidad: e.target.value })} /></Campo>
      </div>
      <div style={{ height: 10 }} />
      <Campo label="Motivo"><input value={d.motivo} onChange={(e) => setD({ ...d, motivo: e.target.value })} /></Campo>
    </Modal>
  );
}

function AjusteModal({ s, onClose, onOk }) {
  const [n, setN] = useState(-1);
  const [m, setM] = useState('');
  return (
    <Modal titulo={`Ajustar: ${s.nombre} (${tallaTxt(s.talla)})`} onClose={onClose} footer={<>
      <button className="btn sec" onClick={onClose}>Cancelar</button>
      <button className="btn" disabled={!Number(n) || !m} onClick={() => onOk(Number(n), m)}>Aplicar</button>
    </>}>
      <p className="muted">Existencia actual: <b>{s.cantidad}</b>. Usa números positivos para sumar y negativos para descontar (pérdida, dañado, conteo físico).</p>
      <div className="grid">
        <Campo label="Cantidad (+/-)"><input type="number" value={n} onChange={(e) => setN(e.target.value)} /></Campo>
        <Campo label="Motivo *"><input value={m} onChange={(e) => setM(e.target.value)} placeholder="Ej: conteo físico, dañado" /></Campo>
      </div>
    </Modal>
  );
}

function ReasignarModal({ s, onClose, onOk }) {
  const [d, setD] = useState({ cantidad: 1, alumnoNombre: '', alumnoCedula: '', alumnoTelefono: '', pedidoNumero: '', nota: '' });
  const [b, setB] = useState(false);
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  return (
    <Modal titulo={`Reasignar: ${s.nombre} (${tallaTxt(s.talla)})`} onClose={onClose} footer={<>
      <button className="btn sec" onClick={onClose}>Cancelar</button>
      <button className="btn ok" disabled={b || (!d.alumnoNombre && !d.pedidoNumero)} onClick={async () => { setB(true); await onOk(d); setB(false); }}>Reasignar y entregar</button>
    </>}>
      <p className="muted">Disponible: <b>{s.cantidad}</b> en {sedeNombre(s.sede)}. Si indicas el N° de pedido del alumno, se vinculará y completará lo que le faltaba de ese artículo.</p>
      <div className="grid">
        <Campo label="Cantidad"><input type="number" min="1" max={s.cantidad} value={d.cantidad} onChange={set('cantidad')} /></Campo>
        <Campo label="N° de pedido del alumno (opcional)"><input value={d.pedidoNumero} onChange={set('pedidoNumero')} /></Campo>
        <Campo label="Nombre del alumno"><input value={d.alumnoNombre} onChange={set('alumnoNombre')} placeholder={d.pedidoNumero ? 'Se toma del pedido' : ''} /></Campo>
        <Campo label="Cédula"><input value={d.alumnoCedula} onChange={set('alumnoCedula')} /></Campo>
        <Campo label="Teléfono"><input value={d.alumnoTelefono} onChange={set('alumnoTelefono')} /></Campo>
      </div>
      <div style={{ height: 10 }} />
      <Campo label="Nota"><input value={d.nota} onChange={set('nota')} /></Campo>
    </Modal>
  );
}
