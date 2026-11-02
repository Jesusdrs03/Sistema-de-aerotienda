'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { listarArticulos, crearPedido, notificar } from '@/lib/data';
import { SEDES, CANALES } from '@/lib/config';
import { useAdmin } from '@/components/AdminContext';
import { Alerta, Campo, Cargando } from '@/components/ui';

const linea = () => ({ articuloId: '', talla: '', cantidad: 1 });

export default function NuevoPedido() {
  const router = useRouter();
  const { admin } = useAdmin();
  const [articulos, setArticulos] = useState(null);
  const [f, setF] = useState({
    numero: '', origen: 'barquisimeto', sede: admin?.sede || 'caracas-santa-monica', notas: '',
    alumno: { nombre: '', cedula: '', telefono: '', email: '', curso: '' },
  });
  const [items, setItems] = useState([linea()]);
  const [notif, setNotif] = useState(true);
  const [canal, setCanal] = useState(process.env.NEXT_PUBLIC_DEFAULT_CHANNEL || 'sms');
  const [msg, setMsg] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { listarArticulos().then((l) => setArticulos(l.filter((a) => a.activo !== false))); }, []);

  const setA = (k) => (e) => setF({ ...f, alumno: { ...f.alumno, [k]: e.target.value } });
  const setItem = (i, k, v) => setItems(items.map((it, j) => (j === i ? { ...it, [k]: v, ...(k === 'articuloId' ? { talla: '' } : {}) } : it)));

  async function guardar(e) {
    e.preventDefault();
    setMsg(null);
    const validos = items.filter((i) => i.articuloId && Number(i.cantidad) > 0);
    if (!validos.length) return setMsg({ type: 'error', text: 'Agrega al menos un artículo' });
    for (const i of validos) {
      const a = articulos.find((x) => x.id === i.articuloId);
      if (a?.tallas?.length && !i.talla) return setMsg({ type: 'error', text: `Selecciona la talla de ${a.nombre}` });
    }
    setGuardando(true);
    try {
      const id = await crearPedido({
        ...f,
        alumno: { ...f.alumno, nombre: f.alumno.nombre.trim(), cedula: f.alumno.cedula.trim() },
        items: validos.map((i) => {
          const a = articulos.find((x) => x.id === i.articuloId);
          return { articuloId: a.id, nombre: a.nombre, talla: i.talla || 'Única', cantidad: Number(i.cantidad) };
        }),
      });
      if (notif && f.alumno.telefono) {
        const r = await notificar(id, 'registro', canal);
        sessionStorage.setItem('notifResult', JSON.stringify(r));
      }
      router.push(`/admin/pedidos/${id}`);
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
      setGuardando(false);
    }
  }

  if (!articulos) return <Cargando />;

  return (
    <form onSubmit={guardar}>
      <h1>Registrar pedido</h1>
      <Alerta msg={msg} onClose={() => setMsg(null)} />
      {!articulos.length && <div className="alert info">Primero crea los artículos en <a href="/admin/articulos">Artículos</a>.</div>}

      <div className="card">
        <h2>Datos del pedido</h2>
        <div className="grid">
          <Campo label="N° de pedido (vacío = automático)"><input value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} placeholder="Número que envía Barquisimeto" /></Campo>
          <Campo label="Enviado desde (origen)">
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
          <Campo label="Teléfono (WhatsApp/SMS)"><input value={f.alumno.telefono} onChange={setA('telefono')} placeholder="0414-1234567" /></Campo>
          <Campo label="Correo"><input type="email" value={f.alumno.email} onChange={setA('email')} /></Campo>
          <Campo label="Curso / Sección"><input value={f.alumno.curso} onChange={setA('curso')} placeholder="Ej: TCP, Piloto privado…" /></Campo>
        </div>
      </div>

      <div className="card">
        <h2>Artículos</h2>
        <div className="tablewrap">
          <table>
            <thead><tr><th>Artículo</th><th>Talla</th><th>Cantidad</th><th></th></tr></thead>
            <tbody>
              {items.map((it, i) => {
                const a = articulos.find((x) => x.id === it.articuloId);
                return (
                  <tr key={i}>
                    <td style={{ minWidth: 220 }}>
                      <select value={it.articuloId} onChange={(e) => setItem(i, 'articuloId', e.target.value)}>
                        <option value="">— Seleccionar —</option>
                        {articulos.map((x) => <option key={x.id} value={x.id}>{x.nombre}{x.categoria ? ` · ${x.categoria}` : ''}</option>)}
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
                    <td>{items.length > 1 && <button type="button" className="btn danger sm" onClick={() => setItems(items.filter((_, j) => j !== i))}>Quitar</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button type="button" className="btn sec sm" style={{ marginTop: 10 }} onClick={() => setItems([...items, linea()])}>+ Agregar artículo</button>
        <div style={{ height: 14 }} />
        <Campo label="Notas"><textarea rows={2} value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} /></Campo>
      </div>

      <div className="card row between">
        <div className="row">
          <label className="chk"><input type="checkbox" checked={notif} onChange={(e) => setNotif(e.target.checked)} /> Enviar mensaje automático al alumno por</label>
          <select style={{ width: 'auto' }} value={canal} onChange={(e) => setCanal(e.target.value)} disabled={!notif}>
            {CANALES.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <button className="btn ok" disabled={guardando}>{guardando ? 'Guardando…' : '💾 Registrar pedido'}</button>
      </div>
    </form>
  );
}
