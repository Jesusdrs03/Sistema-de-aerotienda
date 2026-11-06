'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { listarArticulos, crearPedido, registrarAviso } from '@/lib/data';
import { SEDES } from '@/lib/config';
import { construirMensaje, avisoSugerido } from '@/lib/mensajes';
import { waLink } from '@/lib/utils';
import { useAdmin } from '@/components/AdminContext';
import { Alerta, Campo, Cargando } from '@/components/ui';

const CATS = (arts) => Object.entries(arts.reduce((m, a) => ((m[a.categoria || 'Otros'] ||= []).push(a), m), {})).sort(([a], [b]) => a.localeCompare(b));
const linea = () => ({ articuloId: '', talla: '', cantidad: 1, recibido: '' });

export default function NuevoPedido() {
  const router = useRouter();
  const { admin } = useAdmin();
  const [articulos, setArticulos] = useState(null);
  const [f, setF] = useState({
    numero: '', origen: 'barquisimeto',
    sede: SEDES.some((s) => s.id === admin?.sede) ? admin.sede : 'caracas-santa-monica', notas: '',
    alumno: { nombre: '', cedula: '', telefono: '', email: '', curso: '' },
  });
  const [items, setItems] = useState([linea()]);
  const [avisar, setAvisar] = useState(true);
  const [modo, setModo] = useState('realizado'); // 'realizado' = el alumno lo pidió; 'llego' = ya está en la sede
  const llegoYa = modo === 'llego';

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('llego')) setModo('llego');
    if (q.get('numero')) setF((x) => ({ ...x, numero: q.get('numero') }));
  }, []);
  const [msg, setMsg] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { listarArticulos().then((l) => setArticulos(l.filter((a) => a.activo !== false))); }, []);

  const setA = (k) => (e) => setF({ ...f, alumno: { ...f.alumno, [k]: e.target.value } });
  const setItem = (i, k, v) => setItems(items.map((it, j) => (j === i ? { ...it, [k]: v, ...(k === 'articuloId' ? { talla: '' } : {}) } : it)));
  const llego = (it) => (it.recibido === '' ? Number(it.cantidad) || 0 : Number(it.recibido) || 0);

  const validos = items.filter((i) => i.articuloId && Number(i.cantidad) > 0);
  const incompleto = llegoYa && validos.some((i) => llego(i) < Number(i.cantidad));

  async function guardar(e) {
    e.preventDefault();
    setMsg(null);
    if (!validos.length) return setMsg({ type: 'error', text: 'Agrega al menos un artículo' });
    for (const i of validos) {
      const a = articulos.find((x) => x.id === i.articuloId);
      if (a?.tallas?.length && !i.talla) return setMsg({ type: 'error', text: `Selecciona la talla de ${a.nombre}` });
    }
    const conAviso = avisar && f.alumno.telefono.trim();
    // La ventana se abre en el mismo clic para que el navegador no la bloquee
    const ventana = conAviso ? window.open('about:blank', '_blank') : null;
    setGuardando(true);
    try {
      const data = {
        ...f,
        llego: llegoYa,
        alumno: { ...f.alumno, nombre: f.alumno.nombre.trim(), cedula: f.alumno.cedula.trim() },
        items: validos.map((i) => {
          const a = articulos.find((x) => x.id === i.articuloId);
          return { articuloId: a.id, nombre: a.nombre, talla: i.talla || 'Única', cantidad: Number(i.cantidad), recibido: llegoYa ? llego(i) : 0 };
        }),
      };
      const id = await crearPedido(data);
      if (ventana) {
        const p = { ...data, numero: id, recibidoEn: llegoYa ? new Date() : null };
        const tipo = avisoSugerido(p);
        ventana.location.href = waLink(f.alumno.telefono, construirMensaje(tipo, p, window.location.origin));
        await registrarAviso(id, tipo).catch(() => {});
      }
      router.push(`/admin/pedidos/${id}`);
    } catch (err) {
      if (ventana) ventana.close();
      setMsg({ type: 'error', text: err.message });
      setGuardando(false);
    }
  }

  if (!articulos) return <Cargando />;

  return (
    <form onSubmit={guardar}>
      <h1>Nuevo pedido</h1>
      <Alerta msg={msg} onClose={() => setMsg(null)} />

      <div className="card">
        <h2>¿Qué vas a registrar?</h2>
        <div className="grid">
          <label className={`opcion ${!llegoYa ? 'on' : ''}`}>
            <input type="radio" name="modo" checked={!llegoYa} onChange={() => setModo('realizado')} />
            <div><b>📝 Pedido realizado por el alumno</b><div className="muted">Aún no ha llegado. Queda como “Pedido realizado” y, cuando llegue, lo buscas por su número en <b>Recibir pedido</b>.</div></div>
          </label>
          <label className={`opcion ${llegoYa ? 'on' : ''}`}>
            <input type="radio" name="modo" checked={llegoYa} onChange={() => setModo('llego')} />
            <div><b>📦 Pedido que ya llegó a la sede</b><div className="muted">Para pedidos que llegaron sin haberse registrado antes. Indicas cuánto llegó de cada artículo.</div></div>
          </label>
        </div>
      </div>
      {!articulos.length && <div className="alert info">Primero crea los artículos en <a href="/admin/articulos">Artículos</a>.</div>}

      <div className="card">
        <h2>Datos del pedido</h2>
        <div className="grid">
          <Campo label="N° de pedido (vacío = automático)"><input value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} placeholder="Número que trae el pedido" /></Campo>
          <Campo label="Enviado desde">
            <select value={f.origen} onChange={(e) => setF({ ...f, origen: e.target.value })}>{SEDES.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select>
          </Campo>
          <Campo label="Sede donde retira el alumno">
            <select value={f.sede} onChange={(e) => setF({ ...f, sede: e.target.value })}>{SEDES.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select>
          </Campo>
        </div>
      </div>

      <div className="card">
        <h2>Datos del alumno</h2>
        <div className="grid">
          <Campo label="Nombre y apellido *"><input value={f.alumno.nombre} onChange={setA('nombre')} required /></Campo>
          <Campo label="Cédula *"><input value={f.alumno.cedula} onChange={setA('cedula')} required /></Campo>
          <Campo label="Teléfono (WhatsApp)"><input value={f.alumno.telefono} onChange={setA('telefono')} placeholder="0414-1234567" /></Campo>
          <Campo label="Correo"><input type="email" value={f.alumno.email} onChange={setA('email')} /></Campo>
          <Campo label="Curso / Sección"><input value={f.alumno.curso} onChange={setA('curso')} placeholder="Ej: TCP, PPA…" /></Campo>
        </div>
      </div>

      <div className="card">
        <h2>Artículos</h2>
        <div className="tablewrap">
          <table>
            <thead><tr><th>Artículo</th><th>Talla / variante</th><th>Cantidad</th>{llegoYa && <th>Llegó</th>}<th></th></tr></thead>
            <tbody>
              {items.map((it, i) => {
                const a = articulos.find((x) => x.id === it.articuloId);
                const falta = it.articuloId && llego(it) < Number(it.cantidad);
                return (
                  <tr key={i}>
                    <td style={{ minWidth: 220 }}>
                      <select value={it.articuloId} onChange={(e) => setItem(i, 'articuloId', e.target.value)}>
                        <option value="">— Seleccionar —</option>
                        {CATS(articulos).map(([cat, lista]) => <optgroup key={cat} label={cat}>{lista.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}</optgroup>)}
                      </select>
                    </td>
                    <td style={{ minWidth: 110 }}>
                      {a?.tallas?.length ? (
                        <select value={it.talla} onChange={(e) => setItem(i, 'talla', e.target.value)}>
                          <option value="">—</option>
                          {a.tallas.map((t) => <option key={t}>{t}</option>)}
                        </select>
                      ) : <span className="muted">Única</span>}
                    </td>
                    <td><input className="w80" type="number" min="1" value={it.cantidad} onChange={(e) => setItem(i, 'cantidad', e.target.value)} /></td>
                    {llegoYa && (
                      <td>
                        <input className="w80" type="number" min="0" value={it.recibido === '' ? it.cantidad : it.recibido} onChange={(e) => setItem(i, 'recibido', e.target.value)} />
                        {falta && <div><span className="badge orange">Faltan {Number(it.cantidad) - llego(it)}</span></div>}
                      </td>
                    )}
                    <td>{items.length > 1 && <button type="button" className="btn danger sm" onClick={() => setItems(items.filter((_, j) => j !== i))}>Quitar</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button type="button" className="btn sec sm" style={{ marginTop: 10 }} onClick={() => setItems([...items, linea()])}>+ Agregar artículo</button>
        {llegoYa && validos.length > 0 && (
          <div className={`alert ${incompleto ? 'error' : 'ok'}`} style={{ marginTop: 14, marginBottom: 0 }}>
            {incompleto ? '⚠️ El pedido llegó incompleto: quedará registrado lo que falta.' : '✅ Llegó todo completo.'}
          </div>
        )}
        <div style={{ height: 14 }} />
        <Campo label="Notas"><textarea rows={2} value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} /></Campo>
      </div>

      <div className="card row between">
        <label className="chk">
          <input type="checkbox" checked={avisar} onChange={(e) => setAvisar(e.target.checked)} />
          Abrir WhatsApp para avisarle al alumno al guardar
        </label>
        <button className="btn ok" disabled={guardando}>{guardando ? 'Guardando…' : llegoYa ? '💾 Registrar pedido recibido' : '💾 Registrar pedido realizado'}</button>
      </div>
    </form>
  );
}
