import { adminDb } from '@/lib/firebaseAdmin';
import { pedidoIdFromNumero, estadoPedido, toDate } from '@/lib/utils';
import { sedeNombre, ESTADOS } from '@/lib/config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Consulta pública: devuelve solo datos no sensibles del pedido
export async function GET(req) {
  const numero = new URL(req.url).searchParams.get('numero') || '';
  if (!numero.trim()) return Response.json({ error: 'Indica el número de pedido' }, { status: 400 });
  try {
    const snap = await adminDb().doc(`pedidos/${pedidoIdFromNumero(numero)}`).get();
    if (!snap.exists) return Response.json({ error: 'No encontramos un pedido con ese número' }, { status: 404 });
    const p = snap.data();
    const estado = p.estado || estadoPedido(p);
    const [nom, ape] = (p.alumno?.nombre || '').split(' ');
    return Response.json({
      numero: p.numero,
      alumno: [nom, ape ? ape[0] + '.' : ''].filter(Boolean).join(' '),
      sede: sedeNombre(p.sede),
      origen: sedeNombre(p.origen),
      estado,
      estadoLabel: ESTADOS[estado]?.label || estado,
      creadoEn: toDate(p.creadoEn)?.toISOString() || null,
      recibidoEn: toDate(p.recibidoEn)?.toISOString() || null,
      entregadoEn: toDate(p.entregadoEn)?.toISOString() || null,
      items: (p.items || []).filter((i) => i.cantidad > 0).map((i) => ({
        nombre: i.nombre, talla: i.talla, cantidad: i.cantidad,
        recibido: i.recibido || 0, entregado: i.entregado || 0,
      })),
    });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'Error consultando el pedido' }, { status: 500 });
  }
}
