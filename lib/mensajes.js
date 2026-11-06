import { sedeNombre } from './config';
import { tallaTxt } from './utils';

const lista = (items) => items.map((i) => `• ${i.nombre} (${tallaTxt(i.talla)}) x${i.n}`).join('\n');

export function construirMensaje(tipo, p, baseUrl = '') {
  const app = process.env.NEXT_PUBLIC_APP_NAME || 'Aerotienda';
  const nombre = (p?.alumno?.nombre || '').split(' ')[0] || 'alumno(a)';
  const sede = sedeNombre(p?.sede);
  const items = (p?.items || []).filter((i) => (i.cantidad || 0) > 0);
  const consulta = baseUrl ? `\n\nPuedes consultar tu pedido aquí: ${baseUrl}/?pedido=${encodeURIComponent(p.numero)}` : '';
  const saludo = `Hola ${nombre}, te escribimos de la ${app} ✈️.`;

  switch (tipo) {
    case 'incompleto': {
      const hay = items.filter((i) => (i.recibido || 0) > 0).map((i) => ({ ...i, n: i.recibido }));
      const falta = items.filter((i) => (i.recibido || 0) < i.cantidad).map((i) => ({ ...i, n: i.cantidad - (i.recibido || 0) }));
      return `${saludo}\n\nLlegó parte de tu pedido N° ${p.numero} a la sede ${sede}.` +
        (hay.length ? `\n\nDisponible para retirar:\n${lista(hay)}` : '') +
        `\n\nPendiente por llegar:\n${lista(falta)}\n\nTe avisaremos cuando llegue lo que falta.${consulta}`;
    }
    case 'registro':
      return `${saludo}\n\nRegistramos tu pedido N° ${p.numero}:\n${lista(items.map((i) => ({ ...i, n: i.cantidad })))}\n\nTe avisaremos por este medio cuando llegue a la sede ${sede}.${consulta}`;
    case 'recordatorio':
      return `${saludo}\n\nTe recordamos que tu pedido N° ${p.numero} está en la sede ${sede} esperando por ti. ¡Pasa a retirarlo!${consulta}`;
    case 'entrega':
      return `${saludo}\n\nRegistramos la entrega de tu pedido N° ${p.numero}:\n${lista(items.map((i) => ({ ...i, n: i.entregado || 0 })).filter((i) => i.n > 0))}\n\n¡Gracias por tu compra!`;
    default:
      return `${saludo}\n\nTu pedido N° ${p.numero} ya llegó a la sede ${sede} y está listo para retirar:\n${lista(items.map((i) => ({ ...i, n: i.cantidad })))}${consulta}`;
  }
}

/** Tipo de aviso sugerido según cómo llegó el pedido */
export function avisoSugerido(p) {
  if (p?.estado === 'entregado') return 'entrega';
  if (!p?.recibidoEn) return 'registro';
  const items = (p?.items || []).filter((i) => (i.cantidad || 0) > 0);
  return items.some((i) => (i.recibido || 0) < i.cantidad) ? 'incompleto' : 'llegada';
}
