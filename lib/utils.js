// Utilidades compartidas entre cliente y servidor (sin dependencias de Firebase)

export function pedidoIdFromNumero(numero) {
  return String(numero || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[\/#?\[\]\.]/g, '-');
}

export function slug(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'x';
}

export const tallaTxt = (t) => (t && String(t).trim()) || 'Única';

export function stockId(sede, articuloId, talla) {
  return `${slug(sede)}__${articuloId}__${slug(tallaTxt(talla))}`;
}

// Teléfonos de Venezuela: 0414-1234567 -> +584141234567
export function normalizarTelefono(tel) {
  if (!tel) return '';
  const raw = String(tel).trim();
  let d = raw.replace(/\D/g, '');
  if (!d) return '';
  if (raw.startsWith('+')) return '+' + d;
  if (d.startsWith('58') && d.length >= 12) return '+' + d;
  if (d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) return '+58' + d;
  return '+' + d;
}

// Enlace de WhatsApp con el mensaje ya escrito (sin costo, se abre en WhatsApp Web o la app)
export function waLink(tel, mensaje) {
  const n = normalizarTelefono(tel).replace('+', '');
  return `https://wa.me/${n}?text=${encodeURIComponent(mensaje)}`;
}

export function estadoPedido(p) {
  if (!p) return 'en_transito';
  if (p.anulado) return 'anulado';
  const items = (p.items || []).filter((i) => (i.cantidad || 0) > 0);
  if (items.length && items.every((i) => (i.entregado || 0) >= i.cantidad)) return 'entregado';
  if (items.some((i) => (i.entregado || 0) > 0)) return 'entregado_parcial';
  if (p.recibidoEn) {
    return items.every((i) => (i.recibido || 0) >= i.cantidad) ? 'recibido' : 'recibido_incompleto';
  }
  return 'en_transito';
}

export function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v.toDate === 'function') return v.toDate();
  if (typeof v === 'string' || typeof v === 'number') return new Date(v);
  if (v.seconds) return new Date(v.seconds * 1000);
  return null;
}

export function fmtFecha(v, conHora = true) {
  const d = toDate(v);
  if (!d || isNaN(d)) return '—';
  return d.toLocaleString('es-VE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    ...(conHora ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function descargarCSV(nombre, columnas, filas) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // Separador ";" para que Excel en español lo abra en columnas
  const lineas = [columnas.map((c) => esc(c.h)).join(';')];
  for (const f of filas) lineas.push(columnas.map((c) => esc(c.v(f))).join(';'));
  const blob = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${nombre}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
