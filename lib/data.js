'use client';
import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, query, where, orderBy, limit,
  serverTimestamp, runTransaction, increment, arrayUnion, Timestamp, writeBatch,
} from 'firebase/firestore';
import { getDb, getAuthClient } from './firebase';
import { SEDES } from './config';
import { pedidoIdFromNumero, stockId, estadoPedido, tallaTxt, slug } from './utils';

const usuario = () => getAuthClient().currentUser?.email || 'desconocido';
const hist = (accion, detalle = '') => ({ fecha: new Date().toISOString(), accion, detalle, usuario: usuario() });
const movRef = () => doc(collection(getDb(), 'movimientos'));
const conId = (d) => ({ id: d.id, ...d.data() });

function movimiento(p, item, extra) {
  return {
    fecha: serverTimestamp(),
    sede: p?.sede || null,
    pedidoId: p?.id || null,
    pedidoNumero: p?.numero || null,
    alumnoNombre: p?.alumno?.nombre || null,
    alumnoCedula: p?.alumno?.cedula || null,
    articuloId: item.articuloId,
    articuloNombre: item.nombre,
    talla: tallaTxt(item.talla),
    usuario: usuario(),
    ...extra,
  };
}

function stockSumar(tx, sede, item, cantidad) {
  const ref = doc(getDb(), 'stock', stockId(sede, item.articuloId, item.talla));
  tx.set(ref, {
    sede, articuloId: item.articuloId, nombre: item.nombre, talla: tallaTxt(item.talla),
    cantidad: increment(cantidad), actualizadoEn: serverTimestamp(),
  }, { merge: true });
}

async function stockLeer(tx, sede, item) {
  const ref = doc(getDb(), 'stock', stockId(sede, item.articuloId, item.talla));
  const s = await tx.get(ref);
  return { ref, cantidad: s.exists() ? s.data().cantidad || 0 : 0 };
}

// ================= ARTÍCULOS =================
export async function listarArticulos() {
  const s = await getDocs(query(collection(getDb(), 'articulos'), orderBy('nombre')));
  return s.docs.map(conId);
}

export async function guardarArticulo(id, data) {
  const payload = { ...data, actualizadoEn: serverTimestamp() };
  if (id) await updateDoc(doc(getDb(), 'articulos', id), payload);
  else await addDoc(collection(getDb(), 'articulos'), { ...payload, creadoEn: serverTimestamp() });
}

/** Crea o actualiza los artículos con los productos de la tienda en línea (por id de la tienda o por nombre) */
export async function importarCatalogo(productos) {
  const db = getDb();
  const existentes = await listarArticulos();
  const porTienda = new Map(existentes.filter((a) => a.tiendaId).map((a) => [a.tiendaId, a]));
  const porNombre = new Map(existentes.map((a) => [slug(a.nombre), a]));
  const batch = writeBatch(db);
  let creados = 0; let actualizados = 0;
  for (const p of productos) {
    const ex = porTienda.get(p.tiendaId) || porNombre.get(slug(p.nombre));
    const datos = { ...p, actualizadoEn: serverTimestamp() };
    if (ex) { batch.update(doc(db, 'articulos', ex.id), datos); actualizados++; }
    else { batch.set(doc(collection(db, 'articulos')), { ...datos, descripcion: '', activo: true, creadoEn: serverTimestamp() }); creados++; }
  }
  await batch.commit();
  return { creados, actualizados };
}

// ================= PEDIDOS =================
function resumenLlegada(items) {
  const faltan = items.filter((i) => Number(i.recibido ?? i.cantidad) < i.cantidad)
    .map((i) => `${i.nombre} (${tallaTxt(i.talla)}): faltan ${i.cantidad - Number(i.recibido ?? i.cantidad)}`);
  return faltan.length ? `Llegó INCOMPLETO. ${faltan.join('; ')}` : `Llegó completo (${items.length} línea(s) de artículos)`;
}

async function siguienteNumero(sedeId) {
  const prefijo = SEDES.find((s) => s.id === sedeId)?.prefijo || 'PED';
  const anio = new Date().getFullYear();
  const ref = doc(getDb(), 'contadores', `${prefijo}-${anio}`);
  const n = await runTransaction(getDb(), async (tx) => {
    const s = await tx.get(ref);
    const v = (s.exists() ? s.data().valor : 0) + 1;
    tx.set(ref, { valor: v });
    return v;
  });
  return `${prefijo}-${anio}-${String(n).padStart(4, '0')}`;
}

export async function crearPedido({ llego = false, ...data }) {
  let numero = String(data.numero || '').trim().toUpperCase();
  if (!numero) numero = await siguienteNumero(data.origen);
  const id = pedidoIdFromNumero(numero);
  const ref = doc(getDb(), 'pedidos', id);
  await runTransaction(getDb(), async (tx) => {
    const s = await tx.get(ref);
    if (s.exists()) throw new Error(`Ya existe un pedido con el número ${numero}`);
    const pedido = {
      ...data,
      numero,
      items: data.items.map((i) => ({
        ...i, talla: tallaTxt(i.talla),
        recibido: llego ? Math.max(0, Number(i.recibido ?? i.cantidad) || 0) : 0, entregado: 0, devuelto: 0,
      })),
      creadoEn: serverTimestamp(),
      ...(llego ? { recibidoEn: serverTimestamp() } : {}),
      creadoPor: usuario(),
      historial: [llego
        ? hist('Pedido registrado al llegar a la sede', resumenLlegada(data.items))
        : hist('Pedido realizado', `${data.items.length} línea(s) de artículos`)],
      notificaciones: [],
      cambios: [],
      reasignaciones: [],
    };
    pedido.estado = estadoPedido(llego ? { ...pedido, recibidoEn: new Date() } : pedido);
    tx.set(ref, pedido);
  });
  return id;
}

export async function obtenerPedido(id) {
  const s = await getDoc(doc(getDb(), 'pedidos', id));
  return s.exists() ? conId(s) : null;
}

export async function buscarPedidoPorNumero(numero) {
  return obtenerPedido(pedidoIdFromNumero(numero));
}

export async function listarPedidos(max = 500) {
  const s = await getDocs(query(collection(getDb(), 'pedidos'), orderBy('creadoEn', 'desc'), limit(max)));
  return s.docs.map(conId);
}

export async function listarPedidosRango(desde, hasta) {
  const s = await getDocs(query(
    collection(getDb(), 'pedidos'),
    where('creadoEn', '>=', Timestamp.fromDate(desde)),
    where('creadoEn', '<=', Timestamp.fromDate(hasta)),
    orderBy('creadoEn', 'desc'),
  ));
  return s.docs.map(conId);
}

async function conPedido(id, fn) {
  const ref = doc(getDb(), 'pedidos', id);
  return runTransaction(getDb(), async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists()) throw new Error('El pedido no existe');
    const p = { id: s.id, ...s.data() };
    if (p.anulado) throw new Error('El pedido está anulado');
    return fn(tx, ref, p);
  });
}

/** Registrar llegada del pedido a la sede. recibidos[i] = cantidad recibida; sobrantes[i] = unidades extra que van a stock */
export async function registrarRecepcion(id, recibidos, sobrantes, observacion) {
  return conPedido(id, async (tx, ref, p) => {
    const items = p.items.map((it, i) => ({ ...it, recibido: Math.max(0, Number(recibidos[i]) || 0) }));
    const faltan = items.filter((i) => i.recibido < i.cantidad)
      .map((i) => `${i.nombre} (${tallaTxt(i.talla)}): faltan ${i.cantidad - i.recibido}`);
    items.forEach((it, i) => {
      const extra = Number(sobrantes?.[i]) || 0;
      if (extra > 0) {
        stockSumar(tx, p.sede, it, extra);
        tx.set(movRef(), movimiento(p, it, {
          tipo: 'ingreso', cantidad: extra, motivo: 'Repetido / sobrante en recepción',
          detalle: `Sobrante del pedido ${p.numero}`,
        }));
      }
    });
    const nuevo = { ...p, items, recibidoEn: new Date() };
    const detalle = [faltan.length ? `INCOMPLETO. ${faltan.join('; ')}` : 'Llegó todo correctamente', observacion]
      .filter(Boolean).join(' — ');
    tx.update(ref, {
      items, recibidoEn: serverTimestamp(), estado: estadoPedido(nuevo),
      historial: arrayUnion(hist(p.recibidoEn ? 'Actualización de lo recibido' : 'Llegó a la sede', detalle)),
    });
  });
}

/** Entregar al alumno. entregas[i] = cantidad a entregar ahora. desdeStock descuenta del stock de la sede */
export async function registrarEntrega(id, entregas, { desdeStock = false, observacion = '' } = {}) {
  return conPedido(id, async (tx, ref, p) => {
    const lineas = p.items.map((it, i) => ({ it, i, n: Math.max(0, Number(entregas[i]) || 0) })).filter((l) => l.n > 0);
    if (!lineas.length) throw new Error('Indica al menos una cantidad a entregar');
    const lecturas = [];
    if (desdeStock) {
      for (const l of lineas) {
        const st = await stockLeer(tx, p.sede, l.it);
        if (st.cantidad < l.n) throw new Error(`Stock insuficiente de ${l.it.nombre} (${tallaTxt(l.it.talla)}): hay ${st.cantidad}`);
        lecturas.push({ ...st, n: l.n });
      }
    }
    const items = p.items.map((x) => ({ ...x }));
    for (const l of lineas) {
      const it = items[l.i];
      if ((it.entregado || 0) + l.n > it.cantidad) throw new Error(`${it.nombre}: no puedes entregar más de lo pedido`);
      it.entregado = (it.entregado || 0) + l.n;
      if (desdeStock) it.recibido = Math.max(it.recibido || 0, it.entregado);
      tx.set(movRef(), movimiento(p, it, {
        tipo: 'entrega', cantidad: l.n, motivo: desdeStock ? 'Entregado desde stock' : 'Entrega de pedido',
        detalle: observacion || '',
      }));
    }
    for (const st of lecturas) tx.update(st.ref, { cantidad: st.cantidad - st.n, actualizadoEn: serverTimestamp() });
    const nuevo = { ...p, items };
    const detalle = lineas.map((l) => `${l.it.nombre} (${tallaTxt(l.it.talla)}) x${l.n}`).join(', ');
    tx.update(ref, {
      items, estado: estadoPedido(nuevo),
      ...(estadoPedido(nuevo) === 'entregado' ? { entregadoEn: serverTimestamp() } : {}),
      historial: arrayUnion(hist(desdeStock ? 'Entrega (desde stock)' : 'Entrega al alumno', [detalle, observacion].filter(Boolean).join(' — '))),
    });
  });
}

/** Devolver unidades de una línea del pedido al stock de la sede (repetido, devuelto por alumno, etc.) */
export async function enviarAStock(id, idx, cantidad, motivo, nota) {
  const n = Number(cantidad) || 0;
  if (n <= 0) throw new Error('Cantidad inválida');
  return conPedido(id, async (tx, ref, p) => {
    const items = p.items.map((x) => ({ ...x }));
    const it = items[idx];
    items[idx].devuelto = (it.devuelto || 0) + n;
    if (motivo === 'Devuelto por el alumno') items[idx].entregado = Math.max(0, (it.entregado || 0) - n);
    stockSumar(tx, p.sede, it, n);
    tx.set(movRef(), movimiento(p, it, { tipo: 'devolucion', cantidad: n, motivo, detalle: nota || '' }));
    tx.update(ref, {
      items, estado: estadoPedido({ ...p, items }),
      historial: arrayUnion(hist('Devolución a stock', `${it.nombre} (${tallaTxt(it.talla)}) x${n} — ${motivo}${nota ? ' — ' + nota : ''}`)),
    });
  });
}

/** Cambio: el alumno devuelve un artículo (va a stock) y recibe otro desde stock */
export async function registrarCambio(id, idx, { cantidad, nuevo, motivo, nota }) {
  const n = Number(cantidad) || 0;
  if (n <= 0) throw new Error('Cantidad inválida');
  return conPedido(id, async (tx, ref, p) => {
    const orig = p.items[idx];
    if (n > orig.cantidad) throw new Error('La cantidad supera lo pedido en esa línea');
    const nuevoItem = { articuloId: nuevo.articuloId, nombre: nuevo.nombre, talla: tallaTxt(nuevo.talla) };
    const st = await stockLeer(tx, p.sede, nuevoItem);
    if (st.cantidad < n) throw new Error(`Stock insuficiente de ${nuevoItem.nombre} (${nuevoItem.talla}): hay ${st.cantidad}`);

    const items = p.items.map((x) => ({ ...x }));
    const o = items[idx];
    o.cantidad -= n;
    o.recibido = Math.min(o.recibido || 0, o.cantidad);
    o.entregado = Math.max(0, (o.entregado || 0) - n);
    o.cambiado = (o.cambiado || 0) + n;
    const deTxt = `${orig.nombre} (${tallaTxt(orig.talla)})`;
    items.push({ ...nuevoItem, cantidad: n, recibido: n, entregado: n, devuelto: 0, origenCambio: deTxt });

    stockSumar(tx, p.sede, orig, n);
    tx.update(st.ref, { cantidad: st.cantidad - n, actualizadoEn: serverTimestamp() });
    const aTxt = `${nuevoItem.nombre} (${nuevoItem.talla})`;
    tx.set(movRef(), movimiento(p, orig, {
      tipo: 'cambio', cantidad: n, motivo, detalle: `${deTxt} → ${aTxt}${nota ? ' — ' + nota : ''}`,
      nuevoArticuloId: nuevoItem.articuloId, nuevoArticuloNombre: nuevoItem.nombre, nuevaTalla: nuevoItem.talla,
    }));
    tx.update(ref, {
      items, estado: estadoPedido({ ...p, items }),
      cambios: arrayUnion({ fecha: new Date().toISOString(), de: deTxt, a: aTxt, cantidad: n, motivo, nota: nota || '', usuario: usuario() }),
      historial: arrayUnion(hist('Cambio de artículo', `${deTxt} → ${aTxt} x${n} — ${motivo}`)),
    });
  });
}

export async function anularPedido(id, motivo) {
  return conPedido(id, async (tx, ref) => {
    tx.update(ref, { anulado: true, estado: 'anulado', historial: arrayUnion(hist('Pedido anulado', motivo || '')) });
  });
}

export async function editarAlumno(id, alumno) {
  await updateDoc(doc(getDb(), 'pedidos', id), { alumno, historial: arrayUnion(hist('Datos del alumno editados')) });
}

// ================= STOCK =================
export async function listarStock() {
  const s = await getDocs(collection(getDb(), 'stock'));
  return s.docs.map(conId).sort((a, b) => (a.nombre + a.talla).localeCompare(b.nombre + b.talla));
}

/** Ingreso (+) o salida/ajuste (-) manual de stock */
export async function ajustarStock({ sede, articuloId, nombre, talla, cantidad, motivo }) {
  const n = Number(cantidad) || 0;
  if (!n) throw new Error('Cantidad inválida');
  const item = { articuloId, nombre, talla: tallaTxt(talla) };
  return runTransaction(getDb(), async (tx) => {
    const st = await stockLeer(tx, sede, item);
    if (st.cantidad + n < 0) throw new Error(`No hay suficiente stock (hay ${st.cantidad})`);
    tx.set(st.ref, { sede, ...item, cantidad: st.cantidad + n, actualizadoEn: serverTimestamp() }, { merge: true });
    tx.set(movRef(), movimiento({ sede }, item, {
      tipo: n > 0 ? 'ingreso' : 'ajuste', cantidad: Math.abs(n), motivo: motivo || (n > 0 ? 'Ingreso manual' : 'Ajuste manual'),
    }));
  });
}

/** Reasignar unidades del stock a otro alumno (opcionalmente vinculado a su pedido) */
export async function reasignarStock(stockItem, { cantidad, alumnoNombre, alumnoCedula, alumnoTelefono, pedidoNumero, nota }) {
  const n = Number(cantidad) || 0;
  if (n <= 0) throw new Error('Cantidad inválida');
  return runTransaction(getDb(), async (tx) => {
    const st = await stockLeer(tx, stockItem.sede, stockItem);
    if (st.cantidad < n) throw new Error(`Stock insuficiente (hay ${st.cantidad})`);
    let p = null; let pref = null;
    if (pedidoNumero) {
      pref = doc(getDb(), 'pedidos', pedidoIdFromNumero(pedidoNumero));
      const ps = await tx.get(pref);
      if (!ps.exists()) throw new Error(`No existe el pedido ${pedidoNumero}`);
      p = { id: ps.id, ...ps.data() };
    }
    const alumno = {
      nombre: alumnoNombre || p?.alumno?.nombre || '',
      cedula: alumnoCedula || p?.alumno?.cedula || '',
      telefono: alumnoTelefono || p?.alumno?.telefono || '',
    };
    if (!alumno.nombre) throw new Error('Indica el nombre del alumno o un número de pedido');

    tx.update(st.ref, { cantidad: st.cantidad - n, actualizadoEn: serverTimestamp() });
    tx.set(movRef(), movimiento(p || { sede: stockItem.sede }, stockItem, {
      sede: stockItem.sede, tipo: 'reasignacion', cantidad: n, motivo: 'Reasignado desde stock',
      alumnoNombre: alumno.nombre, alumnoCedula: alumno.cedula, alumnoTelefono: alumno.telefono, detalle: nota || '',
    }));

    if (p) {
      const items = p.items.map((x) => ({ ...x }));
      let restante = n;
      // Si el pedido tenía esa misma pieza pendiente (faltante), se completa con lo reasignado
      for (const it of items) {
        if (restante <= 0) break;
        if (it.articuloId === stockItem.articuloId && tallaTxt(it.talla) === tallaTxt(stockItem.talla)) {
          const pend = it.cantidad - (it.entregado || 0);
          const usar = Math.min(pend, restante);
          if (usar > 0) {
            it.entregado = (it.entregado || 0) + usar;
            it.recibido = Math.max(it.recibido || 0, it.entregado);
            restante -= usar;
          }
        }
      }
      const desc = `${stockItem.nombre} (${tallaTxt(stockItem.talla)}) x${n}`;
      tx.update(pref, {
        items, estado: estadoPedido({ ...p, items }),
        reasignaciones: arrayUnion({ fecha: new Date().toISOString(), articulo: desc, cantidad: n, nota: nota || '', usuario: usuario() }),
        historial: arrayUnion(hist('Reasignación desde stock', `${desc}${nota ? ' — ' + nota : ''}`)),
      });
    }
  });
}

// ================= MOVIMIENTOS / REPORTES =================
export async function listarMovimientos(desde, hasta) {
  const s = await getDocs(query(
    collection(getDb(), 'movimientos'),
    where('fecha', '>=', Timestamp.fromDate(desde)),
    where('fecha', '<=', Timestamp.fromDate(hasta)),
    orderBy('fecha', 'desc'),
  ));
  return s.docs.map(conId);
}

// ================= AVISOS POR WHATSAPP =================
/** Deja constancia de que se abrió WhatsApp para avisar al alumno */
export async function registrarAviso(pedidoId, tipo) {
  await updateDoc(doc(getDb(), 'pedidos', pedidoId), {
    notificaciones: arrayUnion({ fecha: new Date().toISOString(), tipo, canal: 'whatsapp', ok: true, usuario: usuario() }),
  });
}

// ================= TIENDA EN LÍNEA (WooCommerce) =================
/** Trae de la tienda los datos del alumno y los artículos de un pedido */
export async function buscarPedidoTienda(numero) {
  const token = await getAuthClient().currentUser?.getIdToken();
  const r = await fetch(`/api/tienda/pedido?numero=${encodeURIComponent(numero)}`, { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json().catch(() => ({ error: 'Respuesta inválida del servidor' }));
  if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
  return j;
}
