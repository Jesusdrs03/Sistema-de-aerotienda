'use client';
import { useEffect, useState } from 'react';
import { listarArticulos, guardarArticulo } from '@/lib/data';
import { Alerta, Campo, Cargando } from '@/components/ui';

const VACIO = { nombre: '', categoria: '', tallas: '', precio: '', descripcion: '', activo: true };

export default function Articulos() {
  const [lista, setLista] = useState(null);
  const [form, setForm] = useState(VACIO);
  const [editId, setEditId] = useState(null);
  const [msg, setMsg] = useState(null);
  const [filtro, setFiltro] = useState('');

  const cargar = () => listarArticulos().then(setLista).catch((e) => setMsg({ type: 'error', text: e.message }));
  useEffect(() => { cargar(); }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function guardar(e) {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    const tallas = form.tallas.split(',').map((t) => t.trim()).filter(Boolean);
    try {
      await guardarArticulo(editId, {
        nombre: form.nombre.trim(), categoria: form.categoria.trim(), tallas,
        precio: form.precio === '' ? null : Number(form.precio), descripcion: form.descripcion.trim(), activo: !!form.activo,
      });
      setMsg({ type: 'ok', text: editId ? 'Artículo actualizado' : 'Artículo creado' });
      setForm(VACIO); setEditId(null); cargar();
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
  }

  function editar(a) {
    setEditId(a.id);
    setForm({ nombre: a.nombre, categoria: a.categoria || '', tallas: (a.tallas || []).join(', '), precio: a.precio ?? '', descripcion: a.descripcion || '', activo: a.activo !== false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function alternar(a) {
    await guardarArticulo(a.id, { activo: a.activo === false });
    cargar();
  }

  const visibles = (lista || []).filter((a) => (a.nombre + ' ' + (a.categoria || '')).toLowerCase().includes(filtro.toLowerCase()));

  return (
    <>
      <h1>Artículos</h1>
      <Alerta msg={msg} onClose={() => setMsg(null)} />
      <form className="card" onSubmit={guardar}>
        <h2>{editId ? 'Editar artículo' : 'Nuevo artículo'}</h2>
        <div className="grid">
          <Campo label="Nombre *"><input value={form.nombre} onChange={set('nombre')} placeholder="Ej: Camisa piloto manga larga" required /></Campo>
          <Campo label="Categoría"><input value={form.categoria} onChange={set('categoria')} placeholder="Uniforme, Accesorios, Libros…" /></Campo>
          <Campo label="Tallas (separadas por coma)"><input value={form.tallas} onChange={set('tallas')} placeholder="S, M, L, XL  (vacío = talla única)" /></Campo>
          <Campo label="Precio (opcional)"><input type="number" step="0.01" value={form.precio} onChange={set('precio')} /></Campo>
        </div>
        <div style={{ height: 10 }} />
        <Campo label="Descripción"><input value={form.descripcion} onChange={set('descripcion')} /></Campo>
        <div className="row" style={{ marginTop: 12 }}>
          <label className="chk"><input type="checkbox" checked={form.activo} onChange={set('activo')} /> Activo (disponible para pedidos)</label>
          <div style={{ flex: 1 }} />
          {editId && <button type="button" className="btn sec" onClick={() => { setEditId(null); setForm(VACIO); }}>Cancelar</button>}
          <button className="btn">{editId ? 'Guardar cambios' : 'Crear artículo'}</button>
        </div>
      </form>

      <div className="card">
        <div className="row between"><h2>Catálogo ({lista?.length || 0})</h2><input style={{ maxWidth: 260 }} placeholder="Buscar…" value={filtro} onChange={(e) => setFiltro(e.target.value)} /></div>
        {!lista ? <Cargando /> : (
          <div className="tablewrap">
            <table>
              <thead><tr><th>Nombre</th><th>Categoría</th><th>Tallas</th><th>Precio</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {visibles.map((a) => (
                  <tr key={a.id} style={{ opacity: a.activo === false ? .5 : 1 }}>
                    <td><b>{a.nombre}</b>{a.descripcion && <div className="muted">{a.descripcion}</div>}</td>
                    <td>{a.categoria || '—'}</td>
                    <td>{a.tallas?.length ? a.tallas.join(', ') : 'Única'}</td>
                    <td>{a.precio != null ? a.precio : '—'}</td>
                    <td>{a.activo === false ? <span className="badge gray">Inactivo</span> : <span className="badge green">Activo</span>}</td>
                    <td className="row">
                      <button className="btn sec sm" onClick={() => editar(a)}>Editar</button>
                      <button className="btn sec sm" onClick={() => alternar(a)}>{a.activo === false ? 'Activar' : 'Desactivar'}</button>
                    </td>
                  </tr>
                ))}
                {!visibles.length && <tr><td colSpan={6} className="muted">No hay artículos. Crea el primero arriba.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
