'use client';
import { useEffect, useState } from 'react';
import { listarArticulos, guardarArticulo, importarCatalogo } from '@/lib/data';
import catalogoGuardado from '@/lib/catalogoTienda.json';
import { TIENDA_URL } from '@/lib/tienda';
import { Alerta, Campo, Cargando } from '@/components/ui';

const VACIO = { nombre: '', categoria: '', tallas: '', precio: '', descripcion: '', activo: true };

export default function Articulos() {
  const [lista, setLista] = useState(null);
  const [form, setForm] = useState(VACIO);
  const [editId, setEditId] = useState(null);
  const [msg, setMsg] = useState(null);
  const [filtro, setFiltro] = useState('');
  const [importando, setImportando] = useState(false);

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

  async function importar() {
    if (!confirm('Se cargarán los productos de la Aerotienda desde la tienda en línea. Los que ya existan se actualizarán (nombre, categoría, variantes y precio). ¿Continuar?')) return;
    setImportando(true); setMsg(null);
    try {
      let productos; let fuente = 'la tienda en línea';
      try {
        const r = await fetch('/api/tienda');
        const j = await r.json();
        if (!r.ok || !j.productos?.length) throw new Error(j.error);
        productos = j.productos;
      } catch {
        productos = catalogoGuardado; fuente = 'la copia guardada del catálogo (la tienda no respondió)';
      }
      const { creados, actualizados } = await importarCatalogo(productos);
      setMsg({ type: 'ok', text: `Importados desde ${fuente}: ${creados} artículo(s) nuevo(s) y ${actualizados} actualizado(s).` });
      cargar();
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
    setImportando(false);
  }

  async function alternar(a) {
    await guardarArticulo(a.id, { activo: a.activo === false });
    cargar();
  }

  const visibles = (lista || []).filter((a) => (a.nombre + ' ' + (a.categoria || '')).toLowerCase().includes(filtro.toLowerCase()));

  return (
    <>
      <div className="row between">
        <h1>Artículos</h1>
        <button className="btn" disabled={importando} onClick={importar}>{importando ? 'Importando…' : '🛒 Importar / actualizar desde la tienda'}</button>
      </div>
      <p className="muted" style={{ marginTop: -8 }}>Los productos se toman de <a href={`${TIENDA_URL}/categoria-producto/aerotienda/`} target="_blank" rel="noreferrer">store.aeroidea.net (Aerotienda)</a>. También puedes crear artículos a mano.</p>
      <Alerta msg={msg} onClose={() => setMsg(null)} />
      <form className="card" onSubmit={guardar}>
        <h2>{editId ? 'Editar artículo' : 'Nuevo artículo'}</h2>
        <div className="grid">
          <Campo label="Nombre *"><input value={form.nombre} onChange={set('nombre')} placeholder="Ej: Camisa piloto manga larga" required /></Campo>
          <Campo label="Categoría"><input value={form.categoria} onChange={set('categoria')} placeholder="Uniforme, Accesorios, Libros…" /></Campo>
          <Campo label="Tallas / variantes (separadas por coma)"><input value={form.tallas} onChange={set('tallas')} placeholder="S, M, L, XL  (vacío = única)" /></Campo>
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
              <thead><tr><th></th><th>Nombre</th><th>Categoría</th><th>Tallas / variantes</th><th>Precio</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {visibles.map((a) => (
                  <tr key={a.id} style={{ opacity: a.activo === false ? .5 : 1 }}>
                    <td style={{ width: 52 }}>{a.imagen && <img src={a.imagen} alt="" width="44" height="44" style={{ objectFit: 'cover', borderRadius: 6 }} onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />}</td>
                    <td><b>{a.nombre}</b>{a.descripcion && <div className="muted">{a.descripcion}</div>}{a.url && <div><a className="muted" href={a.url} target="_blank" rel="noreferrer">Ver en la tienda ↗</a></div>}</td>
                    <td>{a.categoria || '—'}</td>
                    <td style={{ maxWidth: 320 }} className={a.tallas?.length > 6 ? 'muted' : ''}>{a.tallas?.length ? a.tallas.join(', ') : 'Única'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{a.precio != null ? `${a.precio} ${a.moneda === 'EUR' ? '€' : a.moneda || ''}` : '—'}</td>
                    <td>{a.activo === false ? <span className="badge gray">Inactivo</span> : <span className="badge green">Activo</span>}</td>
                    <td className="row">
                      <button className="btn sec sm" onClick={() => editar(a)}>Editar</button>
                      <button className="btn sec sm" onClick={() => alternar(a)}>{a.activo === false ? 'Activar' : 'Desactivar'}</button>
                    </td>
                  </tr>
                ))}
                {!visibles.length && <tr><td colSpan={7} className="muted">No hay artículos. Usa “Importar desde la tienda” o crea uno arriba.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
