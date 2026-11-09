// Convierte un pedido de WooCommerce (API REST v3) a los datos que usa el sistema
import { decodificar } from './tienda';
import { slug } from './utils';

const RX = {
  cedula: /c[eé]dula|\bdni\b|_dni|documento|identificaci|^_?billing_ci$|^ci$|^_?ci_|n[uú]mero_?id|\brif\b/i,
  curso: /curso|carrera|programa|especialidad/i,
  sede: /sede/i,
};
const prioridad = (n) => (/g[eé]nero/i.test(n) ? 0 : /talla/i.test(n) ? 1 : 2);

function valorTexto(v) {
  if (v == null || typeof v === 'object') return '';
  return decodificar(String(v)).replace(/<[^>]+>/g, '').trim();
}

/** Busca un dato (cédula, curso, sede) en los campos extra del pedido y en los datos de facturación */
function buscarCampo(o, rx) {
  for (const m of o.meta_data || []) {
    if (rx.test(String(m.key)) && valorTexto(m.value)) return valorTexto(m.value);
  }
  for (const [k, v] of Object.entries(o.billing || {})) {
    if (rx.test(k) && valorTexto(v)) return valorTexto(v);
  }
  return '';
}

export function sedeDesdeTexto(t) {
  const s = slug(t);
  if (s.includes('barquisimeto')) return 'barquisimeto';
  if (s.includes('caracas') || s.includes('santa-monica')) return 'caracas-santa-monica';
  return null;
}

export function mapearPedidoTienda(o) {
  const items = (o.line_items || []).map((li) => {
    const metas = (li.meta_data || []).filter((m) => !String(m.key).startsWith('_') && valorTexto(m.display_value ?? m.value));
    const sedeM = metas.find((m) => RX.sede.test(m.display_key || m.key));
    const attrs = metas
      .filter((m) => m !== sedeM)
      .map((m) => ({ nombre: decodificar(m.display_key || m.key), valor: valorTexto(m.display_value ?? m.value) }))
      .sort((a, b) => prioridad(a.nombre) - prioridad(b.nombre));
    return {
      tiendaId: li.product_id,
      nombre: decodificar(li.name),
      variante: attrs.map((a) => a.valor).join(' · '),
      cantidad: Number(li.quantity) || 1,
      sede: sedeM ? valorTexto(sedeM.display_value ?? sedeM.value) : '',
    };
  });
  const b = o.billing || {};
  const sedeTexto = buscarCampo(o, RX.sede) || items.find((i) => i.sede)?.sede || '';
  return {
    numero: String(o.number || o.id),
    estadoTienda: o.status,
    fecha: o.date_created || null,
    total: o.total,
    moneda: o.currency,
    sede: sedeDesdeTexto(sedeTexto),
    sedeTexto,
    alumno: {
      nombre: decodificar([b.first_name, b.last_name].filter(Boolean).join(' ')),
      cedula: buscarCampo(o, RX.cedula),
      telefono: valorTexto(b.phone),
      email: valorTexto(b.email),
      curso: buscarCampo(o, RX.curso),
    },
    notas: valorTexto(o.customer_note),
    items,
  };
}

/** Elige la variante del artículo que corresponde a lo que se compró en la tienda (ej. "M · Azul") */
export function elegirVariante(opciones = [], variante = '') {
  if (!opciones.length) return 'Única';
  const tokens = (s) => s.split('·').map((t) => slug(t)).filter(Boolean);
  const comprado = new Set(tokens(variante));
  let mejor = '';
  let max = 0;
  for (const op of opciones) {
    const t = tokens(op);
    if (t.length && t.every((x) => comprado.has(x)) && t.length > max) { mejor = op; max = t.length; }
  }
  return mejor;
}
