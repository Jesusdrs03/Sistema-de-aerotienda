import { sedeNombre } from './config';

export function construirMensaje(tipo, p, baseUrl = '') {
  const app = process.env.NEXT_PUBLIC_APP_NAME || 'Aerotienda';
  const nombre = (p?.alumno?.nombre || '').split(' ')[0] || 'alumno(a)';
  const sede = sedeNombre(p?.sede);
  const n = (p?.items || []).reduce((a, i) => a + (i.cantidad || 0), 0);
  const url = baseUrl ? ` Consulta el estado en ${baseUrl}/?pedido=${encodeURIComponent(p.numero)}` : '';
  switch (tipo) {
    case 'llegada':
      return `${app}: Hola ${nombre}, tu pedido N° ${p.numero} ya llegó a la sede ${sede} y está listo para retirar.${url}`;
    case 'entrega':
      return `${app}: Hola ${nombre}, tu pedido N° ${p.numero} fue entregado. ¡Gracias por tu compra!`;
    default:
      return `${app}: Hola ${nombre}, tu pedido N° ${p.numero} fue registrado (${n} artículo(s)). Te avisaremos cuando esté disponible en la sede ${sede}.${url}`;
  }
}

export function variablesPlantilla(p) {
  return {
    1: (p?.alumno?.nombre || '').split(' ')[0] || 'alumno(a)',
    2: String(p?.numero || ''),
    3: sedeNombre(p?.sede),
  };
}
